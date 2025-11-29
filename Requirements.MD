# Vinyl Vault – Requirements Specification

## 1. Introduction

### 1.1 Purpose

This document describes the requirements for the Vinyl Vault application, a web-based system to manage a personal vinyl record collection with minimal manual data entry. It is intended for the developer(s) and future maintainers.

### 1.2 Scope

Vinyl Vault lets authenticated users:
- Scan a barcode on a vinyl sleeve.
- Retrieve and store music metadata from external services.
- Manage personal information about each physical record.
- Access the application from the public internet via a Raspberry Pi 5 host.

External marketplaces, full Discogs collection sync, or mobile native apps are out of scope for this version.

### 1.3 Definitions, Acronyms, Abbreviations

- **BFF**: Backend-for-Frontend proxy (Express + Apollo Server).
- **JWT**: JSON Web Token used between BFF and backend.
- **ADMIN**: User role with full permissions including user management.
- **CONTRIBUTOR**: User role with write permissions for own records.
- **READER**: User role with read-only permissions.
- **Release**: A specific music release (artist, album, etc.).
- **Record**: A physical vinyl owned by a user.
- **Session**: HTTP-only cookie-based authentication state.

### 1.4 Stakeholders

- Primary user: Owner of a vinyl collection (admin/contributor).
- Secondary users: Read-only viewers of the collection.
- Operator: The person hosting and maintaining the system on the RPi 5.

## 2. Overall Description

### 2.1 System Context

The system consists of:
- A browser-based React SPA (`packages/frontend`).
- A BFF GraphQL API with session management (`packages/bff`).
- A domain backend GraphQL API with MongoDB (`packages/backend`).
- External services:
  - GitHub OAuth for authentication.
  - Discogs/MusicBrainz for music metadata.

### 2.2 User Roles

- **ADMIN**:
  - Full system access.
  - Manage all records and users.
  - Assign roles to other users.
- **CONTRIBUTOR**:
  - Manage own records (create, update, delete).
  - Cannot manage other users.
- **READER**:
  - View records and details.
  - No modification capabilities.

*Note: First user to authenticate is automatically assigned ADMIN role.*

## 3. Functional Requirements

FR-1 Barcode Scan and Lookup 
- The system shall allow the user to input a barcode via:
  - Camera-based scanning (in supported browsers) or
  - Manual text input. 
- The system shall validate the barcode format and show errors for invalid or unreadable codes.

FR-2 External Metadata Retrieval 
- The system shall search for releases by barcode using at least one external music data service. 
- If multiple releases match, the system shall display a list of candidates for the user to choose from. 
- The system shall store selected release metadata in MongoDB for future reuse.

FR-3 Record Creation 
- The system shall allow an ADMIN/CONTRIBUTOR to create a new record by:
  - Selecting a release retrieved from external services or
  - Manually entering basic information if no release is found. 
- The system shall allow the user to add personal attributes such as purchase date, price, condition, location, and notes.

FR-4 Record Management 
- The system shall allow an ADMIN/CONTRIBUTOR to:
  - Update any personal attributes of their records.
  - Delete records they own. 
- The system shall prevent READER users from creating, updating, or deleting records.

FR-5 Collection Browsing 
- The system shall allow users to:
  - List records with pagination.
  - Filter records by artist, title, year, format, or location.
  - Search records using a free-text search field (e.g., artist/title).

FR-6 Authentication via GitHub ✅ IMPLEMENTED
- The system shall authenticate users using GitHub OAuth Web Application Flow.
- The system shall create or update a local user profile based on GitHub identity.
- The system shall not require separate username/password for the application.
- Implementation: `/auth/github`, `/auth/github/callback`, `/auth/me`, `/auth/logout` endpoints.

FR-7 Authorization and Roles ✅ IMPLEMENTED
- The system shall assign each user one role: ADMIN, CONTRIBUTOR, or READER.
- First authenticated user is automatically assigned ADMIN role.
- Subsequent users are assigned CONTRIBUTOR role by default.
- The system shall restrict access to mutation operations to ADMIN/CONTRIBUTOR users.
- The system shall enforce role-based access control both in the BFF and backend.

FR-8 Session Management ✅ IMPLEMENTED
- The system shall maintain user sessions using HTTP-only cookies between browser and BFF.
- Sessions stored in MongoDB via `connect-mongo`.
- Cookie name: `vinylvault.sid`, secure in production, SameSite=lax.
- The system shall not expose backend JWTs or GitHub tokens to the browser.
- The system shall invalidate sessions upon user logout.

FR-9 Auditability (basic) 
- The system shall store creation and update timestamps for records and users. 
- The system shall allow viewing the current role of each user.

## 4. Non-Functional Requirements

NFR-1 Security 
- All external access to the system shall use HTTPS. 
- JWTs shall be used only between BFF and backend, with short expiration times. 
- MongoDB shall not be directly exposed to the public network.
- OS and dependencies shall be kept up to date with security patches.

NFR-2 Performance 
- The system shall respond to typical user operations (e.g., viewing a record, listing collection) in under 1 second under normal load on the RPi 5. 
- The system shall cache external release data to reduce repeated external API calls.

NFR-3 Usability 
- The UI shall be responsive and usable on mobile and desktop screens. 
- The system shall provide clear feedback for loading, errors, and empty states.

NFR-4 Reliability 
- The system shall be able to restart without manual intervention after a crash (e.g., via systemd or container restart policies). 
- The system shall not lose stored records or releases during restarts (MongoDB persistence).

NFR-5 Maintainability 
- The backend and BFF shall be implemented in TypeScript with a consistent coding style. 
- The architecture shall separate concerns between BFF (auth/proxy) and domain backend (business logic).

NFR-6 Privacy 
- The system shall store only minimal GitHub user data necessary for identification and display. 
- The system shall not store GitHub access tokens long-term; they shall be used only to fetch identity data during login.

## 5. Constraints

- The system must run on a single Raspberry Pi 5 in a home network with port forwarding or secure tunneling.
- Only open-source or free-to-use components should be used, excluding paid proprietary dependencies for core functionality.
- External APIs must be used according to their terms of service and rate limits.

## 6. Implementation Status

### Completed
- ✅ Project structure (pnpm monorepo)
- ✅ GitHub OAuth authentication (FR-6)
- ✅ Session management with MongoDB (FR-8)
- ✅ Role-based authorization model (FR-7)
- ✅ User profile display in UI
- ✅ Docker configuration for MongoDB
- ✅ Caddy reverse proxy configuration

### In Progress
- 🔄 Barcode scanning (FR-1)
- 🔄 External metadata retrieval (FR-2)
- 🔄 Record creation and management (FR-3, FR-4)
- 🔄 Collection browsing (FR-5)

## 7. Open Issues

- Decision between specific external music APIs (Discogs, MusicBrainz, or both).
- Strategy for backup/restore (local NAS, cloud storage, etc.).
- Mobile camera API integration for barcode scanning.