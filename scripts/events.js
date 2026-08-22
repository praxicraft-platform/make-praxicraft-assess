/** Same event list as n8n ASSESS_WEBHOOK_EVENTS (webhook.test is internal). */
const ASSESS_WEBHOOK_EVENTS = [
  { label: "Assessment Started", value: "assessment.started" },
  { label: "Assessment Completed", value: "assessment.completed" },
  { label: "Candidate Violation", value: "candidate.violation" },
  { label: "Candidate Passed", value: "candidate.passed" },
  { label: "Candidate Failed", value: "candidate.failed" },
  { label: "Invitation Expired", value: "invitation.expired" },
  { label: "Pipeline Advanced", value: "pipeline.advanced" },
  { label: "Pipeline Completed", value: "pipeline.completed" },
  { label: "Pipeline Rejected", value: "pipeline.rejected" },
  { label: "Interview Scheduled", value: "interview.scheduled" },
  { label: "Interview Started", value: "interview.started" },
  { label: "Interview Completed", value: "interview.completed" },
  { label: "Interview Cancelled", value: "interview.cancelled" },
  { label: "Interview Analysis Ready", value: "interview.analysis_ready" },
];

module.exports = { ASSESS_WEBHOOK_EVENTS };
