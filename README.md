# SMART Health Check-in Protocol

This repository defines and demonstrates a **Browser-Based Protocol** for sharing health data using **OID4VP (OpenID for Verifiable Presentations)** and **DCQL (Digital Credentials Query Language)**.

## 1. SMART Health Check-in Profile of OID4VP

This section defines the **Protocol Profile**, specifying how OID4VP is used to transport the request and response.

### 1.1 Authorization Request

The Authorization Request MUST follow the requirements of OpenID for Verifiable Presentations 1.0.

**Parameters:**

*   `response_type`: MUST be `vp_token`.
*   `response_mode`: MUST be `fragment` (for browser-based flows).
*   `client_id`: MUST use the `redirect_uri` Client Identifier Prefix.
    *   Format: `redirect_uri:<Redirect_URI>`
    *   Example: `redirect_uri:https://clinic.example.com/callback`
*   `nonce`: REQUIRED.
*   `state`: REQUIRED.
*   `dcql_query`: REQUIRED. A JSON-encoded DCQL query object (defined in Section 2).

**Example Request:**
```
https://wallet.example.com/authorize?
  client_id=redirect_uri:https://clinic.example.com/callback&
  response_type=vp_token&
  response_mode=fragment&
  state=...&
  nonce=...&
  dcql_query={
    "credentials": [
      {
        "id": "req_1",
        "format": "smart_artifact",
        "meta": { "profile": "..." }
      }
    ]
  }
```

### 1.2 Authorization Response

The response is returned to the `redirect_uri` in the URL fragment.

**Parameters:**

*   `vp_token`: REQUIRED. The Verifiable Presentation Token (defined in Section 2).
*   `smart_artifacts`: REQUIRED. The credential data array (defined in Section 2).
*   `state`: REQUIRED. Must match the request state.

---

## 2. DCQL Profile for SMART Health Check-in

This section defines the **Data Profile**, specifying the structure of the DCQL query and the response.

### 2.1 Credential Format: `smart_artifact`

This profile defines a single Credential Format Identifier: **`smart_artifact`**.

The credential query object uses a **standard DCQL structure**. Properties specific to this profile are specified within the `meta` object:

| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | String | **Required.** Unique ID for this request item. |
| `format` | String | **Required.** Must be `"smart_artifact"`. |
| `optional` | Boolean | **Required.** Must be `true` for this profile. Indicates that users may decline to share this credential, and partial responses are valid. |
| `meta` | Object | **Required.** Container for profile-specific constraints. |
| `meta.profile` | String | **Optional.** Canonical URL of a FHIR StructureDefinition (e.g., for Patient, Coverage). |
| `meta.questionnaire` | Object | **Optional.** Full FHIR Questionnaire JSON to be rendered/completed by the user. |
| `meta.questionnaireUrl` | String | **Optional.** Alternative to `questionnaire`: URL reference to a Questionnaire resource. |
| `meta.signing_strategy` | Array | **Optional.** Array of acceptable signing strategies: `["none"]` (default), `["shc_v1"]`, `["shc_v2"]`, or multiple like `["shc_v1", "shc_v2"]`. |
| `require_cryptographic_holder_binding` | Boolean | **Required.** Must be `false` for this profile. |

#### Examples

**Requesting Insurance (Raw Data):**
```json
{
  "credentials": [
    {
      "id": "req_insurance",
      "format": "smart_artifact",
      "optional": true,
      "require_cryptographic_holder_binding": false,
      "meta": {
        "profile": "http://hl7.org/fhir/us/insurance-card/StructureDefinition/C4DIC-Coverage"
      }
    }
  ]
}
```

**Requesting a Form (User Input):**
```json
{
  "credentials": [
    {
      "id": "req_intake",
      "format": "smart_artifact",
      "optional": true,
      "require_cryptographic_holder_binding": false,
      "meta": {
        "questionnaire": {
          "resourceType": "Questionnaire",
          "status": "active",
          "item": [{ "linkId": "1", "text": "Allergies?", "type": "string" }]
        }
      }
    }
  ]
}
```

**Requesting a Signed Immunization Record (SHC):**
```json
{
  "credentials": [
    {
      "id": "req_immunization",
      "format": "smart_artifact",
      "optional": true,
      "require_cryptographic_holder_binding": false,
      "meta": {
        "profile": "http://hl7.org/fhir/StructureDefinition/Immunization",
        "signing_strategy": ["shc_v1", "shc_v2"]
      }
    }
  ]
}
```

### 2.2 Response Structure

To comply with OID4VP structure requirements (Section 6.1) while minimizing payload size, this profile uses a split-payload pattern with **typed wrappers**.

The Authorization Response MUST include two parameters in the URL fragment:

#### `vp_token` (The Mapping)

REQUIRED. A JSON Object where keys correspond to the `id`s defined in the `dcql_query` of the request.

*   **Keys:** The DCQL Request ID string.
*   **Values:** An Array of **Integers**. Each integer is a zero-based index referencing an item in the `smart_artifacts` array.

#### `smart_artifacts` (The Data)

REQUIRED. A JSON Array containing **typed credential wrappers**.

Each wrapper is a JSON Object with:

| Property | Description |
|----------|-------------|
| `type`   | REQUIRED. String. The type of credential data (e.g., `"fhir_resource"`, `"shc"`, `"shl"`). |
| `data`   | REQUIRED. The actual credential payload. Format depends on `type`. (Object for resources, String for links/cards). |

**Example Response:**

Scenario: Insurance request (Index 0) returned as JSON, History request (Index 1) returned as SHL.

```json
{
  "vp_token": {
    "req_insurance": [0],
    "req_history": [1]
  },
  "smart_artifacts": [
    {
      "type": "fhir_resource",
      "data": {
        "resourceType": "Coverage",
        "id": "cov-123",
        "status": "active",
        "payor": [{ "display": "Aetna" }]
      }
    },
    {
      "type": "smart_health_link",
      "data": "shlink:/eyJhbGci..."
    }
  ]
}
```

#### Format-Specific Presentation Definition

For the `smart_artifact` Credential Format, a **Presentation** is defined as a typed wrapper object (as defined above in the `smart_artifacts` array). 

The `vp_token` parameter contains arrays of integer indices that reference these presentations. This indirection pattern:
- Allows many-to-many mapping between request IDs and response data without duplication
- Remains compliant with OID4VP's requirement that presentations be represented "as a string or object, depending on the format" (OID4VP Section 7.1)
- Enables efficient payload encoding when the same credential satisfies multiple requests

**Note:** Client libraries (such as `shl.js`) can rehydrate the response before exposing it to applications by replacing indices with actual data from `smart_artifacts`, unwrapping the typed wrappers in the process.

---

## 3. Browser-Based Implementation (The "Shim")

To enable this protocol in pure browser environments (without backend O ID4VP handlers), this repository provides a reference implementation using a **W3C Digital Credentials API Shim**.

### 3.1 The Shim (`shl.js`)

The `shl.js` library exposes a `SHL.request()` function that mimics the W3C Digital Credentials API but orchestrates the OID4VP flow over standard browser navigation.

```javascript
// Client Code
const result = await SHL.request({
  digital: {
    requests: [{
      protocol: 'openid4vp',
      data: { dcql_query: ... }
    }]
  }
});
```

### 3.2 Transport Mechanism

1.  **Request**: The shim opens the Health App URL (via a Picker) in a popup window with the OID4VP query parameters.
2.  **Response**: The Health App redirects the popup to the `redirect_uri` (e.g., `callback.html`) with the response in the URL fragment.
3.  **Handoff**: The `callback.html` page uses a `BroadcastChannel` to send the `vp_token` and `smart_artifacts` back to the original tab.
4.  **Completion**: The shim receives the data, closes the popup, rehydrates the response, and resolves the Promise.

## 4. Reference Implementation (Demo)

This repository contains a fully functional reference implementation of the protocol.

### 4.1 Components

*   **Requester (`/requester`)**: A demo "Doctor's Clinic" app that initiates the flow.
*   **Picker (`/checkin`)**: A simple UI that helps users select their health app.
*   **Health App (`/source-flexpa`)**: A mock health app implementation that acts as an OID4VP Provider.

### 4.2 Running the Demo

To simulate the cross-origin security model locally:

```bash
./start-local.sh
```

This starts 5 servers on different ports (Requester, Check-in, and Health apps).
Visit **http://requester.localhost:3000** to try the flow.

## 5. License

MIT License
