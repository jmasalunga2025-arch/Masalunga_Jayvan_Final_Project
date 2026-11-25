"""Built-in template library. Each entry describes fields (what the form asks for)
and a layout config (how the document is laid out). Layout logic lives in domain/documents.py."""

SCHOOL = "School Documents"
ADMIN = "Administrative Documents"


def F(key, label, type="text", required=True, default="", placeholder=""):
    return {"key": key, "label": label, "type": type, "required": required,
            "default": default, "placeholder": placeholder}


ORG = F("org_name", "School / organization name", default="Your School Name", placeholder="e.g. Rizal Central School")
DATE = F("date", "Date", "date", default="@today")
SIGN = [F("signatory_name", "Signatory name", placeholder="e.g. Maria Santos"),
        F("signatory_title", "Signatory position", placeholder="e.g. School Principal")]
ONE_SIGN = [{"name": "{{signatory_name}}", "title": "{{signatory_title}}"}]
RECIPIENT = [F("recipient_name", "Recipient name"), F("recipient_position", "Recipient position", required=False),
             F("recipient_org", "Recipient organization", required=False)]
RECIPIENT_LINES = ["{{recipient_name}}", "{{recipient_position}}", "{{recipient_org}}"]

CATALOG = [
    # ------------------------------------------------------------- School documents
    {"slug": "certificate-of-enrollment", "name": "Certificate of Enrollment", "category": SCHOOL, "layout": "letter",
     "description": "Certifies that a student is currently enrolled, for scholarships, IDs or government requirements.",
     "fields": [ORG, F("student_name", "Student name"), F("student_id", "Student ID", required=False),
                F("grade_level", "Grade / year level", placeholder="e.g. Grade 10"), F("school_year", "School year", placeholder="e.g. 2026-2027"),
                F("purpose", "Purpose", default="any legal purpose it may serve"), DATE, *SIGN],
     "config": {"title": "Certificate of Enrollment", "salutation": "To whom it may concern:", "closing": "Respectfully,",
                "paragraphs": ["This is to certify that {{student_name}} is a bonafide student of {{org_name}}, currently enrolled in {{grade_level}} for School Year {{school_year}}.",
                               "Student ID No.: {{student_id}}",
                               "This certification is issued upon the request of the above-named student for {{purpose}}.",
                               "Issued this {{date}}."],
                "signatures": ONE_SIGN}},
    {"slug": "certificate-of-completion", "name": "Certificate of Completion", "category": SCHOOL, "layout": "certificate",
     "description": "A landscape certificate with a modern frame for finished courses, trainings or programs.",
     "fields": [ORG, F("recipient_name", "Recipient name"), F("program_name", "Course / program title"),
                F("hours", "Number of hours", "number", required=False), DATE, *SIGN,
                F("co_signatory_name", "Second signatory", required=False), F("co_signatory_title", "Second signatory position", required=False)],
     "config": {"title": "Certificate of Completion", "accent": "#6D28D9", "frame": "modern",
                "lead": "This certificate is proudly presented to", "recipient": "{{recipient_name}}",
                "paragraphs": ["for successfully completing {{program_name}}.", "Total hours: {{hours}}"],
                "signatures": ONE_SIGN + [{"name": "{{co_signatory_name}}", "title": "{{co_signatory_title}}"}]}},
    {"slug": "certificate-of-recognition", "name": "Certificate of Recognition", "category": SCHOOL, "layout": "certificate",
     "description": "A classic gold-framed certificate honoring outstanding achievement or service.",
     "fields": [ORG, F("recipient_name", "Recipient name"), F("award_title", "Recognition title", placeholder="e.g. Academic Excellence Award"),
                F("reason", "Reason for recognition", "textarea"), DATE, *SIGN,
                F("co_signatory_name", "Second signatory", required=False), F("co_signatory_title", "Second signatory position", required=False)],
     "config": {"title": "Certificate of Recognition", "accent": "#B45309", "frame": "classic",
                "lead": "In grateful recognition, this certificate is awarded to", "recipient": "{{recipient_name}}",
                "paragraphs": ["{{award_title}}", "in recognition of {{reason}}"],
                "signatures": ONE_SIGN + [{"name": "{{co_signatory_name}}", "title": "{{co_signatory_title}}"}]}},
    {"slug": "student-recommendation-letter", "name": "Student Recommendation Letter", "category": SCHOOL, "layout": "letter",
     "description": "A formal letter recommending a student for a scholarship, program or opportunity.",
     "fields": [ORG, DATE, *RECIPIENT, F("student_name", "Student name"), F("purpose", "Purpose of recommendation", placeholder="e.g. the Dean's Scholarship"),
                F("relationship", "Your relationship to the student", placeholder="e.g. class adviser"), F("duration", "How long you have known them", placeholder="e.g. two years"),
                F("strengths", "Strengths and achievements", "textarea"), *SIGN],
     "config": {"recipient_lines": RECIPIENT_LINES, "salutation": "Dear {{recipient_name}}:", "closing": "Sincerely,",
                "subject": "Letter of Recommendation for {{student_name}}",
                "paragraphs": ["I am pleased to recommend {{student_name}} for {{purpose}}. I have known {{student_name}} for {{duration}} as {{relationship}}.",
                               "{{strengths}}",
                               "Based on my experience, I am confident that {{student_name}} will contribute meaningfully to your program. I recommend {{student_name}} without reservation and am happy to provide further information on request."],
                "signatures": ONE_SIGN}},
    {"slug": "permission-letter", "name": "Permission Letter", "category": SCHOOL, "layout": "letter",
     "description": "Asks parents or guardians for permission for a school activity, with a reply slip.",
     "fields": [ORG, DATE, F("recipient_name", "Addressed to", default="Parents / Guardians"), F("student_name", "Student name"),
                F("activity_name", "Activity"), F("activity_date", "Activity date", "date"), F("venue", "Venue"),
                F("details", "Purpose and details", "textarea", required=False), F("reply_by", "Reply on or before", "date", required=False), *SIGN],
     "config": {"salutation": "Dear {{recipient_name}},", "closing": "Respectfully yours,", "subject": "Permission for {{activity_name}}",
                "paragraphs": ["{{org_name}} will hold {{activity_name}} on {{activity_date}} at {{venue}}.", "{{details}}",
                               "In this regard, we respectfully seek your permission for {{student_name}} to take part. Kindly sign and return the slip below on or before {{reply_by}}.",
                               "Parent / Guardian signature: ______________________    Date: ______________"],
                "signatures": ONE_SIGN}},
    {"slug": "formal-request-letter", "name": "Formal Request Letter", "category": SCHOOL, "layout": "letter",
     "description": "A polite, structured letter requesting approval, resources or action.",
     "fields": [ORG, DATE, *RECIPIENT, F("subject", "Subject of request"), F("request_details", "What you are requesting", "textarea"),
                F("reason", "Reason / justification", "textarea", required=False), F("needed_by", "Response needed by", "date", required=False), *SIGN],
     "config": {"recipient_lines": RECIPIENT_LINES, "salutation": "Dear {{recipient_name}}:", "closing": "Respectfully yours,", "subject": "{{subject}}",
                "paragraphs": ["I am writing on behalf of {{org_name}} to formally request {{subject}}.", "{{request_details}}", "{{reason}}",
                               "We kindly ask for your response on or before {{needed_by}}.", "Thank you for your time and consideration."],
                "signatures": ONE_SIGN}},
    {"slug": "school-activity-report", "name": "School Activity Report", "category": SCHOOL, "layout": "report",
     "description": "A numbered report covering objectives, outcomes, challenges and recommendations.",
     "fields": [ORG, F("activity_title", "Activity title"), F("activity_date", "Activity date", "date"), F("venue", "Venue"), F("organizer", "Organizer"),
                F("participants", "Number of participants", "number"), F("objectives", "Objectives (one per line)", "textarea"),
                F("summary", "Summary of activities", "textarea"), F("outcomes", "Outcomes / results", "textarea"),
                F("challenges", "Challenges encountered", "textarea", required=False), F("recommendations", "Recommendations (one per line)", "textarea", required=False),
                F("prepared_by", "Prepared by"), F("prepared_title", "Position"), F("noted_by", "Noted by", required=False), F("noted_title", "Noted by position", required=False)],
     "config": {"title": "School Activity Report",
                "meta": [["Activity", "{{activity_title}}"], ["Date", "{{activity_date}}"], ["Venue", "{{venue}}"], ["Organizer", "{{organizer}}"], ["Participants", "{{participants}}"]],
                "sections": [{"heading": "Objectives", "text": "{{objectives}}", "kind": "list"}, {"heading": "Summary of Activities", "text": "{{summary}}"},
                             {"heading": "Outcomes", "text": "{{outcomes}}"}, {"heading": "Challenges Encountered", "text": "{{challenges}}"},
                             {"heading": "Recommendations", "text": "{{recommendations}}", "kind": "list"}],
                "signatures": [{"label": "Prepared by:", "name": "{{prepared_by}}", "title": "{{prepared_title}}"},
                               {"label": "Noted by:", "name": "{{noted_by}}", "title": "{{noted_title}}"}]}},
    {"slug": "meeting-minutes", "name": "Meeting Minutes", "category": SCHOOL, "layout": "report",
     "description": "Records attendance, agenda, discussion and action items from a meeting.",
     "fields": [ORG, F("meeting_title", "Meeting title"), F("meeting_date", "Date", "date", default="@today"), F("meeting_time", "Time", "time", required=False),
                F("venue", "Venue"), F("attendees", "Attendees (one per line)", "textarea"), F("absent", "Absent (one per line)", "textarea", required=False),
                F("agenda", "Agenda (one per line)", "textarea"), F("discussion", "Discussion", "textarea"),
                F("action_items", "Action items (one per line)", "textarea", required=False), F("next_meeting", "Next meeting", required=False),
                F("prepared_by", "Secretary / recorder"), F("prepared_title", "Position")],
     "config": {"title": "Minutes of the Meeting",
                "meta": [["Meeting", "{{meeting_title}}"], ["Date", "{{meeting_date}}"], ["Time", "{{meeting_time}}"], ["Venue", "{{venue}}"]],
                "sections": [{"heading": "Attendees", "text": "{{attendees}}", "kind": "list"}, {"heading": "Absent", "text": "{{absent}}", "kind": "list"},
                             {"heading": "Agenda", "text": "{{agenda}}", "kind": "numbered"}, {"heading": "Discussion", "text": "{{discussion}}"},
                             {"heading": "Action Items", "text": "{{action_items}}", "kind": "list"}, {"heading": "Next Meeting", "text": "{{next_meeting}}"}],
                "signatures": [{"label": "Prepared by:", "name": "{{prepared_by}}", "title": "{{prepared_title}}"}]}},
    # ------------------------------------------------------------- Administrative documents
    {"slug": "official-memorandum", "name": "Official Memorandum", "category": ADMIN, "layout": "memo",
     "description": "A TO / FROM / DATE / SUBJECT memo for internal communication.",
     "fields": [ORG, F("memo_to", "To"), F("memo_from", "From"), F("cc", "Copy furnished", required=False), DATE, F("subject", "Subject"), F("body", "Message", "textarea")],
     "config": {"title": "Memorandum", "header_rows": [["TO", "{{memo_to}}"], ["FROM", "{{memo_from}}"], ["CC", "{{cc}}"], ["DATE", "{{date}}"], ["SUBJECT", "{{subject}}"]],
                "sections": [{"text": "{{body}}"}]}},
    {"slug": "office-announcement", "name": "Office Announcement", "category": ADMIN, "layout": "announcement",
     "description": "A bold announcement with an event-details box for notice boards and email.",
     "fields": [ORG, F("headline", "Headline"), DATE, F("event_date", "Event date", "date", required=False), F("event_time", "Time", required=False),
                F("venue", "Venue", required=False), F("body", "Announcement text", "textarea"), F("contact", "Contact person", required=False), *SIGN],
     "config": {"title": "Announcement", "headline": "{{headline}}",
                "details": [["When", "{{event_date}}"], ["Time", "{{event_time}}"], ["Where", "{{venue}}"], ["Contact", "{{contact}}"]],
                "sections": [{"text": "{{body}}"}], "signatures": ONE_SIGN}},
    {"slug": "incident-report", "name": "Incident Report", "category": ADMIN, "layout": "form",
     "description": "A structured form for recording what happened, who was involved and the action taken.",
     "fields": [ORG, DATE, F("incident_date", "Date of incident", "date"), F("incident_time", "Time of incident", "time", required=False), F("location", "Location"),
                F("reported_by", "Reported by"), F("reporter_position", "Reporter position"), F("persons_involved", "Persons involved (one per line)", "textarea"),
                F("description", "Description of incident", "textarea"), F("action_taken", "Action taken", "textarea"),
                F("witnesses", "Witnesses (one per line)", "textarea", required=False), F("follow_up", "Recommended follow-up", "textarea", required=False),
                F("receiver_name", "Received by", required=False), F("receiver_title", "Received by position", required=False)],
     "config": {"title": "Incident Report",
                "sections": [{"heading": "Incident Details", "rows": [["Report date", "{{date}}"], ["Date of incident", "{{incident_date}}"], ["Time", "{{incident_time}}"], ["Location", "{{location}}"]]},
                             {"heading": "Persons Involved", "text": "{{persons_involved}}", "kind": "list"}, {"heading": "Description of Incident", "text": "{{description}}"},
                             {"heading": "Action Taken", "text": "{{action_taken}}"}, {"heading": "Witnesses", "text": "{{witnesses}}", "kind": "list"},
                             {"heading": "Recommended Follow-up", "text": "{{follow_up}}"}],
                "signatures": [{"label": "Reported by:", "name": "{{reported_by}}", "title": "{{reporter_position}}"},
                               {"label": "Received by:", "name": "{{receiver_name}}", "title": "{{receiver_title}}"}]}},
    {"slug": "attendance-report", "name": "Attendance Report", "category": ADMIN, "layout": "form",
     "description": "Summarizes attendance for a class or department over a reporting period.",
     "fields": [ORG, DATE, F("class_name", "Class / department"), F("period", "Reporting period", placeholder="e.g. November 1-15, 2026"),
                F("total", "Total enrolled / employees", "number"), F("present", "Present", "number"), F("absent", "Absent", "number"), F("late", "Late", "number", required=False),
                F("absent_names", "Absentees (one per line)", "textarea", required=False), F("remarks", "Remarks", "textarea", required=False),
                F("prepared_by", "Prepared by"), F("prepared_title", "Position")],
     "config": {"title": "Attendance Report",
                "sections": [{"heading": "Summary", "rows": [["Class / department", "{{class_name}}"], ["Reporting period", "{{period}}"], ["Report date", "{{date}}"],
                                                                ["Total", "{{total}}"], ["Present", "{{present}}"], ["Absent", "{{absent}}"], ["Late", "{{late}}"]]},
                             {"heading": "Absentees", "text": "{{absent_names}}", "kind": "list"}, {"heading": "Remarks", "text": "{{remarks}}"}],
                "signatures": [{"label": "Prepared by:", "name": "{{prepared_by}}", "title": "{{prepared_title}}"}]}},
    {"slug": "general-office-letter", "name": "General Office Letter", "category": ADMIN, "layout": "letter",
     "description": "An all-purpose business letter with recipient block and signature.",
     "fields": [ORG, DATE, *RECIPIENT, F("recipient_address", "Recipient address", required=False), F("subject", "Subject"), F("body", "Letter body", "textarea"), *SIGN],
     "config": {"recipient_lines": [*RECIPIENT_LINES, "{{recipient_address}}"], "salutation": "Dear {{recipient_name}}:", "closing": "Sincerely,", "subject": "{{subject}}",
                "paragraphs": ["{{body}}", "Thank you for your attention to this matter."], "signatures": ONE_SIGN}},
]

# The three starter templates that shipped with the original MVP (plain text with placeholders).
LEGACY_STARTERS = [
    {"name": "Formal Letter", "category": "Letters", "body": "Date: {{date}}\n\nTo: {{recipient_name}}\nSubject: {{subject}}\n\nDear {{recipient_name}},\n\n{{message}}\n\nSincerely,\n{{sender_name}}"},
    {"name": "Payment Receipt", "category": "Finance", "body": "PAYMENT RECEIPT\n\nReceipt No.: {{receipt_number}}\nDate: {{date}}\nReceived from: {{client_name}}\nAmount: {{amount}}\nPurpose: {{purpose}}\n\nReceived by: {{company_name}}"},
    {"name": "Certificate of Participation", "category": "Certificates", "body": "CERTIFICATE OF PARTICIPATION\n\nThis certificate is presented to {{participant_name}} for participating in {{event_name}} held on {{date}}.\n\nIssued by: {{company_name}}"},
]


def collect_placeholder_text(node) -> str:
    """Gathers every string with {{placeholders}} in a config (used as the template's searchable `body`)."""
    found: list[str] = []

    def walk(n):
        if isinstance(n, str):
            if "{{" in n:
                found.append(n)
        elif isinstance(n, dict):
            for v in n.values():
                walk(v)
        elif isinstance(n, (list, tuple)):
            for v in n:
                walk(v)
    walk(node)
    return "\n".join(found)


def validate_catalog() -> list[str]:
    """Returns a list of problems (empty = fine). Every placeholder must have a field."""
    problems = []
    from domain.documents import DOCUMENT_TYPES, extract_placeholders
    for entry in CATALOG:
        keys = {f["key"] for f in entry["fields"]}
        if entry["layout"] not in DOCUMENT_TYPES:
            problems.append(f"{entry['slug']}: unknown layout {entry['layout']}")
        for ph in extract_placeholders(collect_placeholder_text(entry["config"])):
            if ph not in keys:
                problems.append(f"{entry['slug']}: placeholder {{{{{ph}}}}} has no field")
    return problems
