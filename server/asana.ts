// @ts-ignore - Asana SDK lacks type declarations
import * as Asana from 'asana';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=asana',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Asana not connected');
  }
  return accessToken;
}

export async function getAsanaApiInstances() {
  const accessToken = await getAccessToken();

  const client = Asana.ApiClient.instance;
  const token = client.authentications['token'];
  token.accessToken = accessToken;

  return {
    tasksApi: new Asana.TasksApi(),
    projectsApi: new Asana.ProjectsApi(),
    usersApi: new Asana.UsersApi(),
    workspacesApi: new Asana.WorkspacesApi()
  };
}

export async function fetchAsanaWorkspaces() {
  const { workspacesApi } = await getAsanaApiInstances();
  const result = await workspacesApi.getWorkspaces({});
  return result?.data || [];
}

export async function fetchAsanaProjects(workspaceGid: string) {
  const { projectsApi } = await getAsanaApiInstances();
  const result = await projectsApi.getProjectsForWorkspace(workspaceGid, {
    opt_fields: 'name,gid,archived'
  });
  return (result?.data || []).filter((p: any) => !p.archived);
}

export async function fetchAsanaTasksFromProject(projectGid: string) {
  const accessToken = await getAccessToken();
  const allTasks: any[] = [];
  let offset: string | undefined;
  let pageCount = 0;
  const optFields = 'name,gid,due_on,completed,created_at,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.enum_value,custom_fields.enum_value.name,custom_fields.text_value,custom_fields.number_value,assignee,assignee.name,notes,num_subtasks';

  do {
    const url = new URL(`https://app.asana.com/api/1.0/projects/${projectGid}/tasks`);
    url.searchParams.set('opt_fields', optFields);
    url.searchParams.set('limit', '100');
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Asana API error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    pageCount++;
    const pageData = result?.data || [];
    allTasks.push(...pageData);
    offset = result?.next_page?.offset;
  } while (offset);

  console.log(`[Asana Fetch] ${allTasks.length} tasks fetched in ${pageCount} pages`);
  return allTasks;
}

export function extractCustomFieldValue(task: any, fieldName: string): string | null {
  if (!task.custom_fields) return null;
  const field = task.custom_fields.find((f: any) =>
    f.name?.toLowerCase().includes(fieldName.toLowerCase())
  );
  if (!field) return null;
  if (field.enum_value?.name) return field.enum_value.name;
  if (field.display_value) return field.display_value;
  if (field.text_value) return field.text_value;
  if (field.number_value !== null && field.number_value !== undefined) return String(field.number_value);
  return null;
}

const FIELD_NAME_MAP: Record<string, string[]> = {
  ucStatus: ['UC TEAM STATUS'],
  ahjStatus: ['AHJ Status.', 'AHJ Status'],
  siteVisitStatus: ['Site visit Request', 'Site visit'],
  contractStatus: ['Contractor'],
  designStatus: ['DESGIN STATUS', 'DESIGN STATUS'],
  pmStatus: ['PM Status'],
  installType: ['Install Type.', 'Install Type'],
  paymentMethod: ['How will the customer pay'],
  rebateStatus: ['GRANTS STATUS.', 'GRANTS STATUS'],
  installTeamStage: ['Install Team Stage'],
};

function findCustomFieldGid(asanaCustomFields: any[], localFieldName: string): string | null {
  const patterns = FIELD_NAME_MAP[localFieldName];
  if (!patterns) return null;
  for (const pattern of patterns) {
    const field = asanaCustomFields.find((f: any) =>
      f.name?.toLowerCase().trim() === pattern.toLowerCase().trim()
    );
    if (field) return field.gid;
  }
  return null;
}

export async function updateAsanaTaskField(taskGid: string, asanaCustomFields: any[], localFieldName: string, newValue: string) {
  const fieldGid = findCustomFieldGid(asanaCustomFields, localFieldName);
  if (!fieldGid) {
    throw new Error(`Could not find Asana custom field for "${localFieldName}"`);
  }

  const accessToken = await getAccessToken();

  const fieldRes = await fetch(`https://app.asana.com/api/1.0/custom_fields/${fieldGid}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const fieldData = await fieldRes.json();
  const enumOptions = fieldData?.data?.enum_options || [];

  const matchingOption = enumOptions.find((opt: any) =>
    opt.name?.toLowerCase().trim() === newValue.toLowerCase().trim()
  );

  if (!matchingOption) {
    throw new Error(`Could not find enum option "${newValue}" for field "${localFieldName}". Available: ${enumOptions.map((o: any) => o.name).join(', ')}`);
  }

  const updateRes = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        custom_fields: {
          [fieldGid]: matchingOption.gid,
        }
      }
    }),
  });

  if (!updateRes.ok) {
    const errBody = await updateRes.text();
    throw new Error(`Asana update failed: ${updateRes.status} ${errBody}`);
  }

  return await updateRes.json();
}

export async function getAsanaEnumOptions(asanaCustomFields: any[], localFieldName: string): Promise<{ gid: string; name: string }[]> {
  const fieldGid = findCustomFieldGid(asanaCustomFields, localFieldName);
  if (!fieldGid) return [];

  const accessToken = await getAccessToken();
  const fieldRes = await fetch(`https://app.asana.com/api/1.0/custom_fields/${fieldGid}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const fieldData = await fieldRes.json();
  const enumOptions = fieldData?.data?.enum_options || [];
  return enumOptions
    .filter((opt: any) => opt.enabled !== false)
    .map((opt: any) => ({ gid: opt.gid, name: opt.name }));
}

export async function updateSubtaskField(subtaskGid: string, fieldName: string, newValue: string) {
  const accessToken = await getAccessToken();
  const taskRes = await fetch(`https://app.asana.com/api/1.0/tasks/${subtaskGid}?opt_fields=custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.enum_value,custom_fields.enum_value.name`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!taskRes.ok) throw new Error(`Failed to fetch subtask ${subtaskGid}`);
  const taskData = await taskRes.json();
  const customFields = taskData?.data?.custom_fields || [];

  const field = customFields.find((f: any) =>
    f.name?.toLowerCase().trim().includes(fieldName.toLowerCase().trim())
  );
  if (!field) throw new Error(`Could not find field "${fieldName}" on subtask`);

  const fieldRes = await fetch(`https://app.asana.com/api/1.0/custom_fields/${field.gid}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const fieldData = await fieldRes.json();
  const enumOptions = fieldData?.data?.enum_options || [];

  const matchingOption = enumOptions.find((opt: any) =>
    opt.name?.toLowerCase().trim() === newValue.toLowerCase().trim()
  );
  if (!matchingOption) {
    throw new Error(`Could not find enum option "${newValue}". Available: ${enumOptions.map((o: any) => o.name).join(', ')}`);
  }

  const updateRes = await fetch(`https://app.asana.com/api/1.0/tasks/${subtaskGid}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: { custom_fields: { [field.gid]: matchingOption.gid } }
    }),
  });
  if (!updateRes.ok) {
    const errBody = await updateRes.text();
    throw new Error(`Asana update failed: ${updateRes.status} ${errBody}`);
  }
  return await updateRes.json();
}

export async function getSubtaskFieldOptions(subtaskGid: string, fieldName: string): Promise<{ gid: string; name: string }[]> {
  const accessToken = await getAccessToken();
  const taskRes = await fetch(`https://app.asana.com/api/1.0/tasks/${subtaskGid}?opt_fields=custom_fields,custom_fields.name`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!taskRes.ok) return [];
  const taskData = await taskRes.json();
  const customFields = taskData?.data?.custom_fields || [];

  const field = customFields.find((f: any) =>
    f.name?.toLowerCase().trim().includes(fieldName.toLowerCase().trim())
  );
  if (!field) return [];

  const fieldRes = await fetch(`https://app.asana.com/api/1.0/custom_fields/${field.gid}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const fieldData = await fieldRes.json();
  return (fieldData?.data?.enum_options || [])
    .filter((opt: any) => opt.enabled !== false)
    .map((opt: any) => ({ gid: opt.gid, name: opt.name }));
}

export async function fetchTaskStories(taskGid: string): Promise<any[]> {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/stories?opt_fields=created_at,created_by,created_by.name,resource_subtype,text,type`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.data || [];
}

export function findStatusChangeInStories(stories: any[], fieldName: string, targetStatus: string): { date: string; user: string } | null {
  for (let i = stories.length - 1; i >= 0; i--) {
    const story = stories[i];
    if (story.resource_subtype === 'enum_custom_field_changed' || story.resource_subtype === 'custom_field_changed') {
      const text = story.text || '';
      if (text.toLowerCase().includes(fieldName.toLowerCase()) && text.toLowerCase().includes(targetStatus.toLowerCase())) {
        return {
          date: story.created_at || '',
          user: story.created_by?.name || 'Unknown',
        };
      }
    }
  }
  return null;
}

export async function postCommentToTask(taskGid: string, commentText: string): Promise<any> {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/stories`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        text: commentText,
      }
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to post comment: ${res.status} ${errBody}`);
  }
  return await res.json();
}

export async function uploadAttachmentToTask(taskGid: string, fileBuffer: Buffer, fileName: string, contentType: string): Promise<any> {
  const accessToken = await getAccessToken();
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const headerBuffer = Buffer.from(header, 'utf-8');
  const footerBuffer = Buffer.from(footer, 'utf-8');
  const body = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);

  const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/attachments?opt_fields=name,gid,download_url,view_url,permanent_url,host`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: body,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to upload attachment: ${res.status} ${errBody}`);
  }
  return await res.json();
}

export async function createSubtaskForTask(parentTaskGid: string, subtaskName: string): Promise<any> {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://app.asana.com/api/1.0/tasks/${parentTaskGid}/subtasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        name: subtaskName,
      }
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to create subtask: ${res.status} ${errBody}`);
  }
  const data = await res.json();
  return data?.data;
}

export async function fetchSubtasksForTask(taskGid: string): Promise<any[]> {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/subtasks?opt_fields=name,gid,completed,due_on,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.enum_value,custom_fields.enum_value.name`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.data || [];
}

export function findHrspSubtask(subtasks: any[]): { gid: string; name: string; status: string | null } | null {
  const hrsp = subtasks.find((st: any) =>
    st.name?.toLowerCase().includes('home renovation savings program')
  );
  if (!hrsp) return null;
  const grantsField = hrsp.custom_fields?.find((f: any) =>
    f.name?.toLowerCase().includes('grants status')
  );
  const status = grantsField?.enum_value?.name || grantsField?.display_value || null;
  return { gid: hrsp.gid, name: hrsp.name, status };
}

export async function fetchTaskAttachments(taskGid: string): Promise<any[]> {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/attachments?opt_fields=name,gid,download_url,view_url,host,created_at,size,resource_type`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.data || [];
}

export async function completeAsanaTask(taskGid: string): Promise<void> {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { completed: true } }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to complete task: ${res.status} ${errBody}`);
  }
}

function extractUcTeamValue(task: any): string | null {
  if (!task.custom_fields) return null;
  const field = task.custom_fields.find((f: any) => {
    const name = f.name?.trim();
    return name === 'UC Team' || name === 'UC TEAM';
  });
  if (!field) return null;
  if (field.enum_value?.name) return field.enum_value.name;
  if (field.display_value) return field.display_value;
  if (field.text_value) return field.text_value;
  return null;
}

export function mapAsanaTaskToProject(task: any) {
  return {
    asanaGid: task.gid,
    name: task.name || 'Unnamed Project',
    installType: extractCustomFieldValue(task, 'install type') || extractCustomFieldValue(task, 'install typ'),
    pmStatus: extractCustomFieldValue(task, 'pm status'),
    ucStatus: extractCustomFieldValue(task, 'uc team status') || extractCustomFieldValue(task, 'uc status'),
    ahjStatus: extractCustomFieldValue(task, 'ahj status') || extractCustomFieldValue(task, 'ahj'),
    designStatus: extractCustomFieldValue(task, 'design') || extractCustomFieldValue(task, 'desgin'),
    quotingStatus: extractCustomFieldValue(task, 'quoting'),
    province: extractCustomFieldValue(task, 'province'),
    asanaDueDate: task.due_on || null,
    paymentMethod: extractCustomFieldValue(task, 'how will the customer pay') || extractCustomFieldValue(task, 'payment'),
    rebateStatus: extractCustomFieldValue(task, 'grants status') || extractCustomFieldValue(task, 'rebate'),
    contractStatus: extractCustomFieldValue(task, 'contractor'),
    siteVisitStatus: extractCustomFieldValue(task, 'site visit'),
    ucTeam: extractUcTeamValue(task),
    installTeamStage: extractCustomFieldValue(task, 'install team stage'),
    propertySector: extractCustomFieldValue(task, 'property sector'),
    projectCreatedDate: task.created_at ? task.created_at.split('T')[0] : null,
    asanaCustomFields: task.custom_fields || [],
  };
}
