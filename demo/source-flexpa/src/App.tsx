import React, { useState, useMemo } from 'react';
import './styles.css';

interface QuestionnaireItem {
  linkId: string;
  text: string;
  type: string;
  required?: boolean;
}

interface Questionnaire {
  resourceType: string;
  id?: string;
  title?: string;
  status: string;
  item: QuestionnaireItem[];
}

interface CredentialMeta {
  profile?: string;
  questionnaire?: Questionnaire;
  questionnaireUrl?: string;
}

interface Credential {
  id: string;
  format: string;
  optional?: boolean;
  meta?: CredentialMeta;
}

interface DCQLQuery {
  credentials: Credential[];
}

interface RequestItem {
  type: 'fhir-profile' | 'fhir-questionnaire';
  id: string;
  profile?: string;
  questionnaire?: Questionnaire;
  questionnaireUrl?: string;
}

function parseRequest(): { state: string; returnUrl: string; nonce: string; requestItems: RequestItem[]; dcqlQuery: DCQLQuery } | { error: string } {
  const params = new URLSearchParams(location.search);

  if (params.get('response_type') !== 'vp_token') {
    return { error: 'Invalid request parameters' };
  }

  const state = params.get('state');
  const clientId = params.get('client_id');
  const nonce = params.get('nonce');

  if (!clientId?.startsWith('redirect_uri:')) {
    return { error: 'Invalid client_id: must start with redirect_uri:' };
  }

  if (!nonce) {
    return { error: 'Missing nonce in authorization request' };
  }

  if (!state) {
    return { error: 'Missing state parameter' };
  }

  const returnUrl = clientId.substring('redirect_uri:'.length);
  const dcqlQuery: DCQLQuery = JSON.parse(params.get('dcql_query') || '{"credentials":[]}');

  const requestItems: RequestItem[] = (dcqlQuery.credentials || []).map(c => {
    const meta = c.meta || {};
    const profile = meta.profile;
    const questionnaire = meta.questionnaire;
    const questionnaireUrl = meta.questionnaireUrl;
    const isQuestionnaire = !!questionnaire || !!questionnaireUrl;

    return {
      type: isQuestionnaire ? 'fhir-questionnaire' : 'fhir-profile',
      id: c.id,
      profile,
      questionnaire,
      questionnaireUrl
    };
  });

  return { state, returnUrl, nonce, requestItems, dcqlQuery };
}

function RequesterOrigin({ returnUrl }: { returnUrl: string }) {
  const origin = useMemo(() => new URL(returnUrl).origin, [returnUrl]);

  return (
    <div className="requester-origin">
      <div className="requester-origin-label">This site is requesting your health data</div>
      <div className="requester-origin-value">{origin}</div>
    </div>
  );
}

function TechnicalDetails({ state, nonce, requestItems }: { state: string; nonce: string; requestItems: RequestItem[] }) {
  const params = new URLSearchParams(location.search);

  return (
    <div className="request-box">
      <h2>Technical Details</h2>
      <div className="request-detail">
        <div className="label">Protocol:</div>
        <div className="value">smart-health-checkin-v1</div>
      </div>
      <div className="request-detail">
        <div className="label">client_id:</div>
        <div className="value">{params.get('client_id')}</div>
      </div>
      <div className="request-detail">
        <div className="label">response_type:</div>
        <div className="value">{params.get('response_type')}</div>
      </div>
      <div className="request-detail">
        <div className="label">response_mode:</div>
        <div className="value">{params.get('response_mode')}</div>
      </div>
      <div className="request-detail">
        <div className="label">state:</div>
        <div className="value">{state}</div>
      </div>
      <div className="request-detail">
        <div className="label">nonce:</div>
        <div className="value">{nonce}</div>
      </div>
      <div className="request-detail">
        <div className="label">Requested items ({requestItems.length}):</div>
        {requestItems.map(item => (
          <div key={item.id} className="request-item">
            <div className="request-item-type">
              {item.type === 'fhir-profile' ? '📋 Profile' : '📝 Questionnaire'}: {item.id}
            </div>
            <div className="value">
              {item.profile || item.questionnaireUrl || 'Inline questionnaire'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsuranceSection({ checked, onChange, hasPatient }: { checked: boolean; onChange: (v: boolean) => void; hasPatient: boolean }) {
  return (
    <div className="section">
      <h3>📋 Requested Records</h3>
      <label className="checkbox-card">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className="checkbox-content">
          <div className="checkbox-title">Share Insurance Card & History</div>
          <div className="checkbox-desc">Includes coverage details and claims history from Aetna</div>
          <div className="card-preview">
            <h4>Aetna PPO Plan</h4>
            <div className="card-info">
              <div><strong>Member:</strong> Jane Doe</div>
              <div><strong>Member ID:</strong> W123456789</div>
              <div><strong>Group:</strong> TECH-2024</div>
            </div>
          </div>
        </div>
      </label>
    </div>
  );
}

function ClinicalSection({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="checkbox-card">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="checkbox-content">
        <div className="checkbox-title">Share Clinical History</div>
        <div className="checkbox-desc">Includes medications, allergies, and conditions</div>
      </div>
    </label>
  );
}

function QuestionnaireSection({
  item,
  idx,
  checked,
  onChange,
  values,
  onValueChange
}: {
  item: RequestItem;
  idx: number;
  checked: boolean;
  onChange: (v: boolean) => void;
  values: Record<string, string>;
  onValueChange: (linkId: string, value: string) => void;
}) {
  const questionnaire = item.questionnaire;
  if (!questionnaire) return null;

  return (
    <div className="section">
      <h3>📝 {questionnaire.title || 'Form to Complete'}</h3>
      <div className="auto-filled-banner">
        ✨ We found matching records and auto-filled your Intake Form
      </div>
      <label className="checkbox-card">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className="checkbox-content">
          <div className="checkbox-title">Share Completed Form</div>
          <div className="form-preview">
            {questionnaire.item.map(question => (
              <div key={question.linkId} className="questionnaire-item">
                <label htmlFor={`q-${idx}-${question.linkId}`}>
                  {question.text}
                  {question.required && <span style={{ color: '#dc2626' }}> *</span>}
                </label>
                {question.type === 'text' ? (
                  <textarea
                    id={`q-${idx}-${question.linkId}`}
                    rows={3}
                    value={values[question.linkId] || ''}
                    onChange={e => onValueChange(question.linkId, e.target.value)}
                    className={values[question.linkId] ? 'auto-filled-field' : ''}
                  />
                ) : (
                  <input
                    type={question.type === 'date' ? 'date' : 'text'}
                    id={`q-${idx}-${question.linkId}`}
                    value={values[question.linkId] || ''}
                    onChange={e => onValueChange(question.linkId, e.target.value)}
                    className={values[question.linkId] ? 'auto-filled-field' : ''}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </label>
    </div>
  );
}

export default function App() {
  const parsed = useMemo(() => parseRequest(), []);

  const [shareInsurance, setShareInsurance] = useState(true);
  const [shareClinical, setShareClinical] = useState(true);
  const [shareQuestionnaires, setShareQuestionnaires] = useState<Record<string, boolean>>({});
  const [questionnaireValues, setQuestionnaireValues] = useState<Record<string, Record<string, string>>>({});

  // Initialize questionnaire states
  useMemo(() => {
    if ('error' in parsed) return;

    const qItems = parsed.requestItems.filter(i => i.type === 'fhir-questionnaire');
    const initialShare: Record<string, boolean> = {};
    const initialValues: Record<string, Record<string, string>> = {};

    qItems.forEach(item => {
      initialShare[item.id] = true;
      initialValues[item.id] = {};

      // Pre-fill values
      if (item.questionnaire?.item) {
        item.questionnaire.item.forEach(q => {
          if (q.linkId === '1') initialValues[item.id][q.linkId] = 'Jane Doe';
          else if (q.linkId === '2') initialValues[item.id][q.linkId] = '1985-06-15';
          else if (q.linkId === '3') initialValues[item.id][q.linkId] = 'Hypertension';
          else if (q.linkId === '4') initialValues[item.id][q.linkId] = 'Lisinopril';
          else if (q.linkId === '5') initialValues[item.id][q.linkId] = 'Penicillin';
        });
      }
    });

    if (Object.keys(initialShare).length > 0) {
      setShareQuestionnaires(initialShare);
      setQuestionnaireValues(initialValues);
    }
  }, [parsed]);

  if ('error' in parsed) {
    return (
      <div className="container">
        <div className="logo">
          {[...Array(6)].map((_, i) => <div key={i} className="pixel" />)}
        </div>
        <h1>Flexpa</h1>
        <div className="error-message">{parsed.error}</div>
      </div>
    );
  }

  const { state, returnUrl, nonce, requestItems, dcqlQuery } = parsed;

  const profiles = requestItems.filter(i => i.type === 'fhir-profile');
  const questionnaires = requestItems.filter(i => i.type === 'fhir-questionnaire');
  const hasPatient = profiles.some(p => p.profile?.toLowerCase().includes('patient'));

  const handleCancel = () => {
    const errorUrl = `${returnUrl}#error=${encodeURIComponent('access_denied')}&error_description=${encodeURIComponent('User declined to share')}&state=${encodeURIComponent(state)}`;
    location.href = errorUrl;
  };

  const handleShare = () => {
    const vp_token: Record<string, Array<{ artifact: number }>> = {};
    const smart_artifacts: Array<{ type: string; data: unknown }> = [];
    const artifactCache = new Map<string, number>();

    const addArtifact = (data: { type: string; data: unknown }) => {
      const hash = JSON.stringify(data);
      if (artifactCache.has(hash)) return artifactCache.get(hash)!;
      const index = smart_artifacts.length;
      smart_artifacts.push(data);
      artifactCache.set(hash, index);
      return index;
    };

    dcqlQuery.credentials.forEach(cred => {
      const meta = cred.meta || {};
      const profile = meta.profile;
      const questionnaire = meta.questionnaire;

      let resourceType: string | null = null;
      if (profile) {
        const match = profile.match(/StructureDefinition\/([A-Za-z0-9-]+)/);
        if (match) {
          const def = match[1];
          if (def.includes('Coverage')) resourceType = 'Coverage';
          else if (def.toLowerCase().includes('patient')) resourceType = 'Patient';
          else resourceType = def;
        }
      }
      if (questionnaire) resourceType = 'QuestionnaireResponse';

      let isShared = false;
      if (resourceType === 'Coverage') isShared = shareInsurance;
      else if (resourceType === 'Patient') isShared = shareClinical;
      else if (resourceType === 'QuestionnaireResponse') isShared = shareQuestionnaires[cred.id] ?? false;

      if (!isShared) return;

      const resources: unknown[] = [];

      if (resourceType === 'Coverage') {
        resources.push({
          resourceType: 'Coverage',
          id: 'coverage-1',
          status: 'active',
          subscriberId: 'W123456789',
          beneficiary: { reference: 'Patient/patient-1', display: 'Jane Doe' },
          payor: [{ display: 'Aetna' }],
          class: [{ type: { coding: [{ code: 'group' }] }, value: 'TECH-2024' }]
        });
      } else if (resourceType === 'Patient') {
        resources.push({
          resourceType: 'Patient',
          id: 'patient-1',
          name: [{ text: 'Jane Doe', family: 'Doe', given: ['Jane'] }],
          birthDate: '1985-06-15'
        });
      } else if (resourceType === 'QuestionnaireResponse') {
        const values = questionnaireValues[cred.id] || {};
        const items = Object.entries(values)
          .filter(([, v]) => v)
          .map(([linkId, value]) => ({
            linkId,
            answer: [{ valueString: value }]
          }));

        resources.push({
          resourceType: 'QuestionnaireResponse',
          status: 'completed',
          item: items
        });
      }

      const presentations = resources.map(res => ({
        artifact: addArtifact({ type: 'fhir_resource', data: res })
      }));

      vp_token[cred.id] = presentations;
    });

    const redirectUrl = `${returnUrl}#vp_token=${encodeURIComponent(JSON.stringify(vp_token))}&smart_artifacts=${encodeURIComponent(JSON.stringify(smart_artifacts))}&state=${encodeURIComponent(state)}`;
    location.href = redirectUrl;
  };

  return (
    <div className="container">
      <div className="logo">
        {[...Array(6)].map((_, i) => <div key={i} className="pixel" />)}
      </div>
      <h1>Flexpa</h1>
      <div className="subtitle">Building blocks of health data</div>

      <RequesterOrigin returnUrl={returnUrl} />
      <TechnicalDetails state={state} nonce={nonce} requestItems={requestItems} />

      {profiles.length > 0 && (
        <>
          <InsuranceSection
            checked={shareInsurance}
            onChange={setShareInsurance}
            hasPatient={hasPatient}
          />
          {hasPatient && (
            <ClinicalSection checked={shareClinical} onChange={setShareClinical} />
          )}
        </>
      )}

      {questionnaires.map((item, idx) => (
        <QuestionnaireSection
          key={item.id}
          item={item}
          idx={idx}
          checked={shareQuestionnaires[item.id] ?? true}
          onChange={v => setShareQuestionnaires(prev => ({ ...prev, [item.id]: v }))}
          values={questionnaireValues[item.id] || {}}
          onValueChange={(linkId, value) =>
            setQuestionnaireValues(prev => ({
              ...prev,
              [item.id]: { ...prev[item.id], [linkId]: value }
            }))
          }
        />
      ))}

      <div className="actions">
        <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleShare}>Share Selected Data</button>
      </div>
    </div>
  );
}
