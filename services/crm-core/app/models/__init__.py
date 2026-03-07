from app.models.base import TenantBase
from app.models.tenant import Tenant
from app.models.user import User
from app.models.data_import import DataImport
from app.models.lead import Lead
from app.models.deal import Deal
from app.models.contact import Contact
from app.models.organization import Organization
from app.models.task import Task
from app.models.note import Note
from app.models.call_log import CallLog
from app.models.lookups import (
    LeadStatus,
    DealStatus,
    LeadSource,
    Industry,
    Territory,
    LostReason,
    Product,
)
from app.models.sla import ServiceLevelAgreement, ServiceLevelPriority, ServiceDay
from app.models.view_settings import ViewSettings
from app.models.assignment import Assignment, AssignmentRule
from app.models.communication import Communication, Comment
from app.models.notification import Notification
from app.models.status_change_log import StatusChangeLog
from app.models.pivot_tables import DealContact, LeadProduct, DealProduct
from app.models.tag import Tag
from app.models.quick_reply import QuickReply

# Messaging pipeline models — import order matters: pivot table first so
# Conversation can reference ConversationTag.__table__ without forward-ref issues.
from app.models.conversation_tag import ConversationTag
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.escalation import Escalation
from app.models.media_file import MediaFile

# Operational / observability models
from app.models.webhook_event import WebhookEvent
from app.models.usage_tracking import UsageTracking
from app.models.audit_log import AuditLog

__all__ = [
    "TenantBase",
    "Tenant",
    "User",
    "DataImport",
    "Lead",
    "Deal",
    "Contact",
    "Organization",
    "Task",
    "Note",
    "CallLog",
    "LeadStatus",
    "DealStatus",
    "LeadSource",
    "Industry",
    "Territory",
    "LostReason",
    "Product",
    "ServiceLevelAgreement",
    "ServiceLevelPriority",
    "ServiceDay",
    "ViewSettings",
    "Assignment",
    "AssignmentRule",
    "Communication",
    "Comment",
    "Notification",
    "StatusChangeLog",
    "DealContact",
    "LeadProduct",
    "DealProduct",
    "Tag",
    "QuickReply",
    # Messaging pipeline
    "ConversationTag",
    "Conversation",
    "Message",
    "Escalation",
    "MediaFile",
    # Operational / observability
    "WebhookEvent",
    "UsageTracking",
    "AuditLog",
]
