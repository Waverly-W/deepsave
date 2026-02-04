# DeepSave Pro - Product Requirements Document (PRD)

> **Status:** Approved
> **Version:** 2.0 (Post-Interrogation)
> **Last Updated:** 2026-02-04

## 1. Executive Summary
DeepSave Pro is a self-hosted, hybrid-architecture knowledge management system running on personal NAS. It solves the "digital hoarding" problem by processing captured content through AI agents for automated classification, tagging, and summarization.

**Key Pivot Points (v2.0):**
*   **Hardware Architecture**: Decoupled "Storage Node" (NAS i3-8100) and "Compute Node" (Remote Gaming PC 14600KF).
*   **Security First**: Public web access mandated. Security upgraded to JWT + 2FA (TOTP).
*   **Ingestion Control**: Shift from passive clipboard monitoring to active **Chrome Extension** clipping.
*   **Data Integrity**: Strict Logic Delete (Soft Delete) with Trash Bin recovery.

## 2. User Roles & Authentication
*   **Single User / Family Mode**:
    *   **Admin**: Full access to system config, Docker containers, file system.
    *   **Auth Flow**: Login (Username/Password) -> 2FA Challenge (Google Authenticator/Authy) -> JWT Token Issue.
    *   **Session**: Short-lived Access Token (15min) + Long-lived Refresh Token (7 days).

## 3. Functional Requirements

### 3.1 Module: Ingestion (The Gateway)
*   **F-IN-01: Chrome Extension Clipper**
    *   Context menu "Save to DeepSave".
    *   Popup: Shows "Saving...", allows identifying "Tags" manually before submit.
    *   Payload: Sends URL + Cookies (Optional) + Raw HTML (if possible/needed for fallback) to Backend.
*   **F-IN-02: Fallback Ingestion**
    *   If Server-side scraping fails (403/Captcha), User gets a "Task Failed" notification in Web UI.
    *   Action: User can manually copy-paste text/content into the "Manual Import" modal.

### 3.2 Module: Processing Pipeline (The Brain)
*   **Step 1: Universal Scraper**
    *   Attempt `trafilatura` fetch.
    *   If fail, queue for `playwright` (headless).
    *   If fail, mark `status: error_manual_required`.
*   **Step 2: Classification (The Router)**
    *   Input: Raw Text.
    *   Model: Use small, fast model (local CPU or cheap API) to classify into: `Article`, `Image`, `Video`, `Product`, `Code`, `Paper`.
*   **Step 3: Agentic Processing**
    *   Based on class, route to specific prompt/model (e.g., `Product` -> extract Price/Specs).
    *   **Compute Node Routing**: If Local LLM is selected, request forwarded to `http://GAMING_PC_IP:11434` instead of localhost.

### 3.3 Module: Storage & Management
*   **F-DATA-01: Soft Delete**
    *   User clicks Delete -> `is_deleted = true`, `deleted_at = now()`.
    *   Items moved to "Trash Bin" virtual folder.
*   **F-DATA-02: Garbage Collection**
    *   "Empty Trash": Hard delete from DB + Remove files from NAS FS + Remove Vector from Chroma.
    *   "Restore": Reset flags.

## 4. Non-Functional Requirements
*   **Performance**:
    *   NAS (i3-8100): Handle web server, DB, Redis, and orchestration.
    *   Remote Node (14600KF): Handle heavy Ollama inference.
*   **Network**:
    *   Frontend must handle network latency gracefully (Optimistic UI updates).
*   **Security**:
    *   All API endpoints (except `/login`, `/webhook`) protected by `Bearer` token.
    *   Rate limiting on Login interface to prevent Brute Force.

## 5. UI/UX Guidelines
*   **Theme**: Dark Mode by default.
*   **Responsiveness**: Mobile-first for Reading/Browsing. Desktop-first for Management/Settings.
*   **Feedback**: Toast notifications for every state change (Processing -> Completed).
