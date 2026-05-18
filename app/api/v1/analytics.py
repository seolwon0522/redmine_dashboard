"""
api/v1/analytics.py — 고급 분석 엔드포인트
이슈 트렌드, 벨로시티, 우선순위 분포, 담당자 성과 등
"""
from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query

from app.api.v1.deps import get_issue_service
from app.services.issue_service import IssueService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/trend")
async def get_issue_trend(
    project_id: str | None = Query(None, description="프로젝트 ID"),
    days: int = Query(30, ge=7, le=365, description="집계 일수"),
    service: IssueService = Depends(get_issue_service),
):
    """
    일별 이슈 생성/해결 트렌드 (최근 N일)
    """
    raw = await service.get_all_issues(project_id)
    issues = raw["issues"]
    today = date.today()

    daily: dict[str, dict] = {}
    for i in range(days):
        d = (today - timedelta(days=days - 1 - i)).isoformat()
        daily[d] = {"date": d, "created": 0, "closed": 0, "active": 0}

    for issue in issues:
        created_s = (issue.get("created_on") or "")[:10]
        updated_s = (issue.get("updated_on") or "")[:10]
        is_closed = issue.get("status_group") == "closed"

        if created_s in daily:
            daily[created_s]["created"] += 1
        if is_closed and updated_s in daily:
            daily[updated_s]["closed"] += 1

    # 활성 이슈 수: 날짜별 누적 계산
    running = 0
    for row in daily.values():
        running += row["created"] - row["closed"]
        row["active"] = max(0, running)

    return {
        "project_id": project_id,
        "days": days,
        "trend": list(daily.values()),
        "cached_at": datetime.now(),
    }


@router.get("/velocity")
async def get_velocity(
    project_id: str | None = Query(None, description="프로젝트 ID"),
    service: IssueService = Depends(get_issue_service),
):
    """
    주간 이슈 처리 벨로시티 (최근 8주)
    """
    raw = await service.get_all_issues(project_id)
    issues = raw["issues"]
    today = date.today()

    weeks: list[dict] = []
    for w in range(7, -1, -1):
        week_end = today - timedelta(weeks=w)
        week_start = week_end - timedelta(days=6)
        label = f"{week_start.month}/{week_start.day}"
        created = 0
        closed = 0
        for issue in issues:
            created_s = (issue.get("created_on") or "")[:10]
            updated_s = (issue.get("updated_on") or "")[:10]
            try:
                cd = date.fromisoformat(created_s)
                if week_start <= cd <= week_end:
                    created += 1
            except ValueError:
                pass
            if issue.get("status_group") == "closed":
                try:
                    ud = date.fromisoformat(updated_s)
                    if week_start <= ud <= week_end:
                        closed += 1
                except ValueError:
                    pass
        weeks.append({"week": label, "created": created, "closed": closed,
                      "velocity": closed, "net": closed - created})

    avg_velocity = sum(w["velocity"] for w in weeks) / max(1, len(weeks))

    return {
        "project_id": project_id,
        "weeks": weeks,
        "avg_velocity": round(avg_velocity, 1),
        "cached_at": datetime.now(),
    }


@router.get("/distribution")
async def get_distribution(
    project_id: str | None = Query(None, description="프로젝트 ID"),
    service: IssueService = Depends(get_issue_service),
):
    """
    우선순위별, 트래커별, 상태 그룹별 이슈 분포 + 담당자 성과 지표
    """
    raw = await service.get_all_issues(project_id)
    issues = raw["issues"]

    priority_map: dict[str, int] = defaultdict(int)
    tracker_map: dict[str, int] = defaultdict(int)
    status_map: dict[str, int] = defaultdict(int)
    assignee_perf: dict[str, dict] = defaultdict(lambda: {"name": "", "total": 0, "closed": 0, "overdue": 0})
    age_buckets = {"0-3일": 0, "4-7일": 0, "8-14일": 0, "15-30일": 0, "30일+": 0}
    today = date.today()

    for issue in issues:
        p = issue.get("priority") or "Normal"
        t = issue.get("tracker") or "기타"
        g = issue.get("status_group") or "other"
        assignee = issue.get("assigned_to") or "미할당"

        priority_map[p] += 1
        tracker_map[t] += 1
        status_map[g] += 1

        entry = assignee_perf[assignee]
        entry["name"] = assignee
        entry["total"] += 1
        if g == "closed":
            entry["closed"] += 1
        if issue.get("is_overdue"):
            entry["overdue"] += 1

        # 이슈 나이 (생성일 기준)
        created_s = (issue.get("created_on") or "")[:10]
        if created_s and g != "closed":
            try:
                cd = date.fromisoformat(created_s)
                age = (today - cd).days
                if age <= 3:
                    age_buckets["0-3일"] += 1
                elif age <= 7:
                    age_buckets["4-7일"] += 1
                elif age <= 14:
                    age_buckets["8-14일"] += 1
                elif age <= 30:
                    age_buckets["15-30일"] += 1
                else:
                    age_buckets["30일+"] += 1
            except ValueError:
                pass

    # 담당자 성과 정렬 (total 기준)
    top_assignees = sorted(
        [v for v in assignee_perf.values() if v["total"] > 0],
        key=lambda x: x["total"],
        reverse=True,
    )[:10]
    for a in top_assignees:
        a["close_rate"] = round(a["closed"] / max(1, a["total"]) * 100, 1)

    return {
        "project_id": project_id,
        "total": len(issues),
        "by_priority": dict(priority_map),
        "by_tracker": dict(tracker_map),
        "by_status_group": dict(status_map),
        "age_distribution": age_buckets,
        "top_assignees": top_assignees,
        "cached_at": datetime.now(),
    }


@router.get("/summary")
async def get_ai_summary(
    project_id: str | None = Query(None, description="프로젝트 ID"),
    service: IssueService = Depends(get_issue_service),
):
    """
    프로젝트 데이터를 분석하여 AI 리포트 요약 생성
    """
    raw = await service.get_all_issues(project_id)
    issues = raw["issues"]

    total = len(issues)
    active_list = [i for i in issues if i.get("status_group") != "closed"]
    active = len(active_list)
    overdue = len([i for i in active_list if i.get("is_overdue")])
    high_prio_list = ["Immediate", "Urgent", "High", "긴급", "높음"]
    high_priority = len([i for i in active_list if i.get("priority") in high_prio_list])
    unassigned = len([i for i in active_list if not i.get("assigned_to")])

    # 헬스 점수 단순 계산
    health_score = 100 - (overdue * 5 + high_priority * 2 + unassigned * 3)
    health_score = max(10, min(100, health_score))

    # 요약 문장 생성
    headlines = []
    if health_score >= 85:
        headlines.append("전반적인 프로젝트 관리 상태가 매우 우수하며, 지연 리스크가 최소화되어 있습니다.")
    elif health_score >= 65:
        headlines.append("프로젝트 운영이 전반적으로 안정적이나, 일부 지표에서 개선이 권장됩니다.")
    else:
        headlines.append("현재 프로젝트의 리스크 지수가 임계치를 초과했습니다. 즉각적인 운영 점검이 필요합니다.")

    insights = []
    if overdue > 0:
        insights.append(f"마감 기한을 넘긴 이슈가 {overdue}건 식별되었습니다. 우선순위 조정 및 일정 재협의가 필요합니다.")
    if high_priority > 3:
        insights.append(f"고우선순위 작업이 {high_priority}건 집중되어 있어, 리소스 병목이 발생할 가능성이 높습니다.")
    if unassigned > 0:
        insights.append(f"담당자가 지정되지 않은 작업 {unassigned}건에 대한 소유권 할당이 시급합니다.")

    if not insights:
        insights.append("현재 모든 활성 작업이 정상 범위 내에서 관리되고 있습니다.")

    return {
        "project_id": project_id,
        "summary": " ".join(headlines + insights),
        "health_score": health_score,
        "metrics": {
            "total": total,
            "active": active,
            "overdue": overdue,
            "unassigned": unassigned
        },
        "recommendations": [
            "지연 이슈(Overdue) 담당자와 1:1 일정 동기화",
            "고우선순위 작업에 대한 리소스 추가 배정 검토",
            "미할당 이슈 리스트 확인 및 팀 내 분배"
        ] if overdue > 0 or unassigned > 0 or high_priority > 5 else ["현재의 양호한 운영 상태를 유지하며 주간 모니터링 지속"],
        "analyzed_at": datetime.now()
    }
