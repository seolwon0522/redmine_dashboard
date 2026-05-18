import logging
from collections import defaultdict
from datetime import date, datetime
from typing import Any

import textile

from app.client.redmine_client import RedmineClient
from app.core.cache import TTLCache
from app.core.config import Settings
from app.services.utils import calc_overdue, fetch_project_issues, parse_api_date, resolve_project_id

logger = logging.getLogger(__name__)

STALE_DAYS = 7
DUE_SOON_DAYS = 7


def _textile_to_html(text: str | None) -> str | None:
    if not text:
        return None
    try:
        return textile.textile(text)
    except Exception:
        logger.debug("Textile conversion failed; returning raw text.")
        return None


def _build_related_issues(raw_issue: dict[str, Any], base_url: str) -> list[dict[str, Any]]:
    issue_id = raw_issue.get("id")
    related: list[dict[str, Any]] = []
    seen: set[tuple[str, int]] = set()

    parent = raw_issue.get("parent")
    if parent and parent.get("id"):
        parent_id = parent["id"]
        seen.add(("parent", parent_id))
        related.append(
            {
                "id": parent_id,
                "label": parent.get("subject") or f"Parent issue #{parent_id}",
                "relation_type": "parent",
                "url": f"{base_url}/issues/{parent_id}",
            }
        )

    for child in raw_issue.get("children", []):
        child_id = child.get("id")
        if not child_id or ("child", child_id) in seen:
            continue
        seen.add(("child", child_id))
        related.append(
            {
                "id": child_id,
                "label": child.get("subject") or f"Child issue #{child_id}",
                "relation_type": "child",
                "url": f"{base_url}/issues/{child_id}",
            }
        )

    for relation in raw_issue.get("relations", []):
        relation_type = relation.get("relation_type") or "related"
        left_id = relation.get("issue_id")
        right_id = relation.get("issue_to_id")
        related_id = right_id if left_id == issue_id else left_id
        if not related_id or (relation_type, related_id) in seen:
            continue
        seen.add((relation_type, related_id))
        related.append(
            {
                "id": related_id,
                "label": f"Issue #{related_id}",
                "relation_type": relation_type,
                "url": f"{base_url}/issues/{related_id}",
            }
        )

    return related


class IssueService:
    def __init__(self, client: RedmineClient, cache: TTLCache, settings: Settings):
        self._client = client
        self._cache = cache
        self._settings = settings

    async def get_summary(self, project_id: str | None = None) -> dict:
        pid = resolve_project_id(project_id, self._settings)
        issues = await fetch_project_issues(
            client=self._client,
            cache=self._cache,
            settings=self._settings,
            project_id=pid,
        )

        today = date.today()
        status_groups = self._settings.dashboard.status_groups
        overdue_exclude = self._settings.get_excluded_status_ids(
            self._settings.dashboard.overdue_rule.exclude_status_groups
        )

        group_counts: dict[str, int] = {group: 0 for group in status_groups}
        overdue_count = 0

        for issue in issues:
            status_id = issue.get("status", {}).get("id")
            group = self._settings.get_status_group(status_id)
            if group:
                group_counts[group] += 1

            if status_id not in overdue_exclude:
                is_overdue, _ = calc_overdue(issue.get("due_date"), today)
                if is_overdue:
                    overdue_count += 1

        return {
            "project_id": pid,
            "total": len(issues),
            "by_status_group": group_counts,
            "overdue": overdue_count,
            "cached_at": datetime.now(),
        }

    async def get_overdue_issues(self, project_id: str | None = None) -> dict:
        pid = resolve_project_id(project_id, self._settings)
        issues = await fetch_project_issues(
            client=self._client,
            cache=self._cache,
            settings=self._settings,
            project_id=pid,
        )

        today = date.today()
        base_url = self._client.base_url
        overdue_exclude = self._settings.get_excluded_status_ids(
            self._settings.dashboard.overdue_rule.exclude_status_groups
        )

        overdue_list = []
        for issue in issues:
            status_id = issue.get("status", {}).get("id")
            due_str = issue.get("due_date")
            if not due_str or status_id in overdue_exclude:
                continue

            is_overdue, days_overdue = calc_overdue(due_str, today)
            if not is_overdue:
                continue

            assigned = issue.get("assigned_to")
            overdue_list.append(
                {
                    "id": issue["id"],
                    "subject": issue.get("subject", ""),
                    "due_date": due_str,
                    "assigned_to": assigned.get("name") if assigned else None,
                    "status": issue.get("status", {}).get("name", ""),
                    "priority": issue.get("priority", {}).get("name"),
                    "days_overdue": days_overdue,
                    "url": f"{base_url}/issues/{issue['id']}",
                }
            )

        overdue_list.sort(key=lambda item: item["days_overdue"], reverse=True)

        return {
            "project_id": pid,
            "count": len(overdue_list),
            "issues": overdue_list,
            "cached_at": datetime.now(),
        }

    async def get_all_issues(self, project_id: str | None = None) -> dict:
        pid = resolve_project_id(project_id, self._settings)
        issues = await fetch_project_issues(
            client=self._client,
            cache=self._cache,
            settings=self._settings,
            project_id=pid,
        )

        today = date.today()
        base_url = self._client.base_url
        closed_ids = self._settings.get_excluded_status_ids(("closed",))
        overdue_exclude = self._settings.get_excluded_status_ids(
            self._settings.dashboard.overdue_rule.exclude_status_groups
        )

        result = []
        for issue in issues:
            status_id = issue.get("status", {}).get("id")
            group = self._settings.get_status_group(status_id) or "other"
            assigned = issue.get("assigned_to")
            author = issue.get("author")
            tracker = issue.get("tracker")
            due_str = issue.get("due_date")
            created_raw = issue.get("created_on") or ""
            updated_raw = issue.get("updated_on") or ""
            parsed_due_date = parse_api_date(due_str)
            days_until_due = (parsed_due_date - today).days if parsed_due_date is not None else None
            updated_date = parse_api_date(updated_raw)
            days_since_update = (today - updated_date).days if updated_date is not None else None

            is_overdue = False
            days_overdue = 0
            if due_str and status_id not in overdue_exclude:
                is_overdue, days_overdue = calc_overdue(due_str, today)

            is_due_soon = (
                status_id not in closed_ids
                and days_until_due is not None
                and 0 <= days_until_due <= DUE_SOON_DAYS
            )
            is_stale = (
                status_id not in closed_ids
                and days_since_update is not None
                and days_since_update >= STALE_DAYS
            )

            result.append(
                {
                    "id": issue["id"],
                    "subject": issue.get("subject", ""),
                    "status": issue.get("status", {}).get("name", ""),
                    "status_id": status_id,
                    "status_group": group,
                    "priority": issue.get("priority", {}).get("name"),
                    "assigned_to": assigned.get("name") if assigned else None,
                    "assigned_to_id": assigned.get("id") if assigned else None,
                    "author": author.get("name") if author else None,
                    "tracker": tracker.get("name") if tracker else None,
                    "due_date": due_str,
                    "created_on": created_raw[:10] if created_raw else None,
                    "updated_on": updated_raw[:10] if updated_raw else None,
                    "done_ratio": issue.get("done_ratio", 0),
                    "is_overdue": is_overdue,
                    "days_overdue": days_overdue,
                    "is_due_soon": is_due_soon,
                    "days_until_due": days_until_due,
                    "is_stale": is_stale,
                    "days_since_update": days_since_update,
                    "url": f"{base_url}/issues/{issue['id']}",
                }
            )

        result.sort(key=lambda item: item.get("updated_on") or "", reverse=True)

        return {
            "project_id": pid,
            "total": len(result),
            "issues": result,
            "cached_at": datetime.now(),
        }

    async def get_issue_detail(self, issue_id: int) -> dict:
        cache_key = f"issue_detail:{issue_id}"

        async def _factory():
            return await self._client.fetch_issue_detail(
                issue_id,
                include="journals,attachments,relations,children",
            )

        raw = await self._cache.get_or_set(cache_key, _factory, ttl=60)
        base_url = self._client.base_url

        assigned = raw.get("assigned_to")
        author = raw.get("author")
        tracker = raw.get("tracker")
        category = raw.get("category")
        version = raw.get("fixed_version")
        status = raw.get("status", {})
        priority = raw.get("priority", {})

        detail: dict[str, Any] = {
            "id": raw.get("id"),
            "subject": raw.get("subject", ""),
            "description": raw.get("description") or None,
            "description_html": _textile_to_html(raw.get("description")),
            "status": status.get("name", ""),
            "status_id": status.get("id"),
            "status_group": self._settings.get_status_group(status.get("id", 0)) or "other",
            "priority": priority.get("name"),
            "assigned_to": assigned.get("name") if assigned else None,
            "assigned_to_id": assigned.get("id") if assigned else None,
            "author": author.get("name") if author else None,
            "tracker": tracker.get("name") if tracker else None,
            "category": category.get("name") if category else None,
            "version": version.get("name") if version else None,
            "start_date": raw.get("start_date"),
            "due_date": raw.get("due_date"),
            "done_ratio": raw.get("done_ratio", 0),
            "created_on": raw.get("created_on"),
            "updated_on": raw.get("updated_on"),
            "url": f"{base_url}/issues/{raw.get('id')}",
            "redmine_base_url": base_url,
            "attachments": [],
            "related_issues": _build_related_issues(raw, base_url),
        }

        detail["attachments"] = [
            {
                "id": attachment.get("id"),
                "filename": attachment.get("filename", "attachment"),
                "filesize": attachment.get("filesize"),
                "content_type": attachment.get("content_type"),
                "content_url": attachment.get("content_url", ""),
            }
            for attachment in raw.get("attachments", [])
            if attachment.get("id") and attachment.get("content_url")
        ]

        timeline: list[dict[str, Any]] = []
        for journal in raw.get("journals", []):
            changes = [
                {
                    "field": change.get("name", ""),
                    "property": change.get("property", ""),
                    "old_value": change.get("old_value"),
                    "new_value": change.get("new_value"),
                }
                for change in journal.get("details", [])
            ]
            notes = journal.get("notes") or None
            user = journal.get("user", {})
            timeline.append(
                {
                    "id": journal.get("id"),
                    "user": user.get("name", ""),
                    "created_on": journal.get("created_on", ""),
                    "notes": notes,
                    "notes_html": _textile_to_html(notes),
                    "changes": changes,
                }
            )

        detail["journals"] = timeline
        return detail

    async def update_issue_status(self, issue_id: int, status_id: int, project_id: str | None = None) -> None:
        """이슈 상태 업데이트"""
        await self._client.update_issue(issue_id, {"status_id": status_id})

        # Invalidate caches
        pid = resolve_project_id(project_id, self._settings)
        await self._cache.delete(f"project_issues:{pid}")
        await self._cache.delete(f"issue_detail:{issue_id}")



