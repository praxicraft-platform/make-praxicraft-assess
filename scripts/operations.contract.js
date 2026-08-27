/**
 * Operation → Public API path contract.
 * Keep in sync with n8n-nodes-praxicraft-assess operations.contract.ts
 * and backend/apps/assess/public_urls.py.
 */
const PUBLIC_API_OPERATIONS = [
  { resource: "assessment", operation: "list", method: "GET", pathExample: "/assessments/" },
  { resource: "assessment", operation: "get", method: "GET", pathExample: "/assessments/{slug}/" },
  { resource: "assessment", operation: "create", method: "POST", pathExample: "/assessments/create/" },
  { resource: "assessment", operation: "update", method: "PATCH", pathExample: "/assessments/{slug}/update/" },
  { resource: "assessment", operation: "duplicate", method: "POST", pathExample: "/assessments/{slug}/duplicate/" },
  { resource: "assessment", operation: "listResults", method: "GET", pathExample: "/assessments/{slug}/results/" },
  { resource: "assessment", operation: "listTasks", method: "GET", pathExample: "/assessments/{slug}/tasks/" },
  { resource: "assessment", operation: "attachTasks", method: "POST", pathExample: "/assessments/{slug}/tasks/attach/" },
  { resource: "assessment", operation: "replaceTasks", method: "PUT", pathExample: "/assessments/{slug}/tasks/replace/" },
  { resource: "assessment", operation: "removeTask", method: "DELETE", pathExample: "/assessments/{slug}/tasks/remove/" },

  { resource: "task", operation: "list", method: "GET", pathExample: "/tasks/" },
  { resource: "task", operation: "listPlatform", method: "GET", pathExample: "/platform-tasks/" },
  { resource: "task", operation: "create", method: "POST", pathExample: "/tasks/create/" },
  { resource: "task", operation: "get", method: "GET", pathExample: "/tasks/{id}/" },
  { resource: "task", operation: "update", method: "PATCH", pathExample: "/tasks/{id}/" },
  { resource: "task", operation: "delete", method: "DELETE", pathExample: "/tasks/{id}/" },

  { resource: "invitation", operation: "list", method: "GET", pathExample: "/invites/" },
  { resource: "invitation", operation: "invite", method: "POST", pathExample: "/assessments/{slug}/invites/" },
  { resource: "invitation", operation: "bulkInvite", method: "POST", pathExample: "/assessments/{slug}/invites/bulk/" },
  { resource: "invitation", operation: "get", method: "GET", pathExample: "/invites/{token}/" },
  { resource: "invitation", operation: "getResult", method: "GET", pathExample: "/invites/{token}/result/" },
  { resource: "invitation", operation: "remind", method: "POST", pathExample: "/invites/{token}/remind/" },
  { resource: "invitation", operation: "cancel", method: "DELETE", pathExample: "/invites/{token}/" },

  { resource: "pipeline", operation: "list", method: "GET", pathExample: "/pipelines/" },
  { resource: "pipeline", operation: "get", method: "GET", pathExample: "/pipelines/{slug}/" },
  { resource: "pipeline", operation: "enroll", method: "POST", pathExample: "/pipelines/{slug}/enroll/" },
  { resource: "pipeline", operation: "bulkEnroll", method: "POST", pathExample: "/pipelines/{slug}/enroll/bulk/" },
  { resource: "pipeline", operation: "listEnrollments", method: "GET", pathExample: "/pipelines/{slug}/enrollments/" },
  { resource: "pipeline", operation: "getEnrollment", method: "GET", pathExample: "/pipelines/enrollments/{id}/" },
  { resource: "pipeline", operation: "reject", method: "POST", pathExample: "/pipelines/enrollments/{id}/reject/" },
  { resource: "pipeline", operation: "hold", method: "POST", pathExample: "/pipelines/enrollments/{id}/hold/" },
  { resource: "pipeline", operation: "unhold", method: "POST", pathExample: "/pipelines/enrollments/{id}/unhold/" },

  { resource: "webhook", operation: "list", method: "GET", pathExample: "/webhooks/" },
  { resource: "webhook", operation: "create", method: "POST", pathExample: "/webhooks/create/" },
  { resource: "webhook", operation: "get", method: "GET", pathExample: "/webhooks/{id}/" },
  { resource: "webhook", operation: "update", method: "PATCH", pathExample: "/webhooks/{id}/" },
  { resource: "webhook", operation: "delete", method: "DELETE", pathExample: "/webhooks/{id}/" },
  { resource: "webhook", operation: "listDeliveries", method: "GET", pathExample: "/webhooks/{id}/deliveries/" },
  { resource: "webhook", operation: "test", method: "POST", pathExample: "/webhooks/{id}/test/" },

  { resource: "organisation", operation: "get", method: "GET", pathExample: "/org/" },
  { resource: "organisation", operation: "stats", method: "GET", pathExample: "/org/stats/" },
  { resource: "organisation", operation: "listTeam", method: "GET", pathExample: "/org/team/" },
  { resource: "organisation", operation: "listSquads", method: "GET", pathExample: "/org/squads/" },
  { resource: "organisation", operation: "getSquad", method: "GET", pathExample: "/org/squads/{id}/" },
  { resource: "organisation", operation: "listSquadMembers", method: "GET", pathExample: "/org/squads/{id}/members/" },
  { resource: "organisation", operation: "auditLog", method: "GET", pathExample: "/org/audit-log/" },

  { resource: "interview", operation: "list", method: "GET", pathExample: "/interviews/" },
  { resource: "interview", operation: "create", method: "POST", pathExample: "/interviews/create/" },
  { resource: "interview", operation: "bulkCreate", method: "POST", pathExample: "/interviews/bulk/" },
  { resource: "interview", operation: "get", method: "GET", pathExample: "/interviews/{id}/" },
  { resource: "interview", operation: "cancel", method: "POST", pathExample: "/interviews/{id}/cancel/" },
  { resource: "interview", operation: "reschedule", method: "POST", pathExample: "/interviews/{id}/reschedule/" },
  { resource: "interview", operation: "analysis", method: "GET", pathExample: "/interviews/{id}/analysis/" },
  { resource: "interview", operation: "replay", method: "GET", pathExample: "/interviews/{id}/replay/" },
  { resource: "interview", operation: "share", method: "POST", pathExample: "/interviews/{id}/share/" },
  { resource: "interview", operation: "analytics", method: "GET", pathExample: "/interviews/analytics/" },
  { resource: "interview", operation: "listTemplates", method: "GET", pathExample: "/interviews/templates/" },
  { resource: "interview", operation: "createTemplate", method: "POST", pathExample: "/interviews/templates/create/" },
  { resource: "interview", operation: "updateTemplate", method: "PATCH", pathExample: "/interviews/templates/{id}/update/" },
  { resource: "interview", operation: "deleteTemplate", method: "DELETE", pathExample: "/interviews/templates/{id}/delete/" },
  { resource: "interview", operation: "listOrgTasks", method: "GET", pathExample: "/interviews/org-tasks/" },

  { resource: "integration", operation: "list", method: "GET", pathExample: "/integrations/" },
  { resource: "integration", operation: "connect", method: "GET", pathExample: "/integrations/{provider}/connect/" },
  { resource: "integration", operation: "test", method: "POST", pathExample: "/integrations/{provider}/test/" },
];

module.exports = { PUBLIC_API_OPERATIONS };
