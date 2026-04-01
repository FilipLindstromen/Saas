import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy | BrainDump",
  description: "How BrainDump handles your data, AI processing, and third-party services.",
};

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        padding: "2rem 1.25rem 3rem",
      }}
    >
      <div style={{ maxWidth: "42rem", margin: "0 auto" }}>
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem" }}>
          <Link
            href="/"
            style={{ color: "var(--text-secondary)", textDecoration: "underline", textUnderlineOffset: "3px" }}
          >
            ← Back to BrainDump
          </Link>
        </p>
        <article>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.5rem", lineHeight: 1.2 }}>
            Privacy
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)", margin: "0 0 2rem" }}>
            How BrainDump treats your information. This describes what the application actually does in code
            today—not a generic legal template. If you self-host BrainDump, your deployment administrator is the
            data controller for that instance.
          </p>

          <section style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.65rem" }}>
              Account and what is stored about you
            </h2>
            <p style={{ margin: "0 0 0.75rem", lineHeight: 1.65, color: "var(--text-secondary)" }}>
              Sign-in uses email and a password (handled by NextAuth with a JWT session). Your user record in the
              database is linked to everything you create in the app: voice dumps (transcripts), organized items
              (tasks, notes, reflections, calendar-style entries, and related fields), projects, tags, and similar
              workspace data. That data is stored in the application database and is associated with your user ID,
              so it is personally identifiable in the sense that it belongs to your account.
            </p>
          </section>

          <section style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.65rem" }}>
              AI: organizing, transcription, coach, and suggestions
            </h2>
            <p style={{ margin: "0 0 0.75rem", lineHeight: 1.65, color: "var(--text-secondary)" }}>
              AI features run only when you are signed in. The server calls OpenAI using an API key configured on the
              server (<code style={{ fontSize: "0.9em", opacity: 0.95 }}>OPENAI_API_KEY</code>). Your content is sent to
              OpenAI only as needed for the feature you trigger—not continuously in the background.
            </p>
            <ul
              style={{
                margin: "0 0 0.75rem",
                paddingLeft: "1.25rem",
                lineHeight: 1.65,
                color: "var(--text-secondary)",
              }}
            >
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Organize</strong> sends the text of
                your dump (transcript) to the model, along with context the app already knows—such as your work project
                names from the database, areas/categories you have used, optional custom categories, and
                locale/date hints—so the model can propose structured items. The model does not “read your entire
                account” on its own; it receives what this request includes.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Voice transcription</strong> uploads
                your audio recording to OpenAI (e.g. Whisper) and returns text. The audio is part of that API request.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Image-to-text</strong> (when you use
                it) sends your image to OpenAI’s vision-capable chat model so readable text (notes, handwriting,
                screenshots, etc.) can be extracted as plain text for the app.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Coach chat</strong> builds a text
                summary of your recent organized items and recent dumps from the database (titles, descriptions,
                schedules, tags, etc., within size limits) and sends that, plus your messages, to the chat model so
                replies can reflect your workspace.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Suggested next actions</strong> sends
                a condensed description of the items you are asking about (titles, content snippets, scheduling,
                project names) to the model to generate suggestions.
              </li>
            </ul>
            <p style={{ margin: 0, lineHeight: 1.65, color: "var(--text-secondary)" }}>
              OpenAI processes those requests under their terms and privacy policy. The people operating the server
              (and typical cloud hosting) may also see traffic and logs in line with their infrastructure practices.
              BrainDump does not claim that prompts are invisible to the host—only that they are used to provide the
              feature.
            </p>
            <p style={{ margin: "0.75rem 0 0", lineHeight: 1.65, color: "var(--text-secondary)" }}>
              Long voice recordings are transcribed in shorter segments when needed so each request stays within
              service limits; segmenting happens on your device before upload, so the same privacy rules apply as for
              any other transcription request.
            </p>
          </section>

          <section style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.65rem" }}>
              What stays on your device
            </h2>
            <p style={{ margin: 0, lineHeight: 1.65, color: "var(--text-secondary)" }}>
              Several preferences are saved only in your browser (for example theme, text size, UI toggles, optional
              RevenueCat gating). If you connect Google Calendar, OAuth tokens and related settings are stored
              locally in the browser unless you import events into BrainDump—in which case the imported events become
              part of your stored workspace data like any other entry. Apple Calendar imports on native iOS use
              device calendar access only when you explicitly run an import.
            </p>
          </section>

          <section style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.65rem" }}>
              Other services
            </h2>
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.25rem",
                lineHeight: 1.65,
                color: "var(--text-secondary)",
              }}
            >
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Subscriptions</strong>: When enabled,
                RevenueCat may process purchase-related identifiers according to their policy.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Password reset</strong>: If the
                deployment configures email (e.g. Resend), your email address and reset link are sent through that
                provider. If email is not configured, resets may not be delivered automatically.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Optional media APIs</strong>: The
                project may be configured with stock or GIF provider keys; if those features are used in your build,
                search requests would go to those providers as implemented.
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.65rem" }}>
              Deleting entries (workspace, trash, and permanent removal)
            </h2>
            <ul
              style={{
                margin: "0 0 0.75rem",
                paddingLeft: "1.25rem",
                lineHeight: 1.65,
                color: "var(--text-secondary)",
              }}
            >
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Move to trash</strong>: When you
                remove an organized item from a list, it is usually{" "}
                <em style={{ fontStyle: "italic" }}>soft-deleted</em>: it stays in the database with a trash timestamp,
                hidden from normal views, until you restore it from Trash in the sidebar or until you delete it forever.
                Linked dump rows and other references follow the same account as before.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Delete forever / empty trash</strong>:
                Actions in the Trash screen permanently remove those rows from the application database (hard delete).
                This cannot be undone in the app.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Bulk delete</strong>: Domain-wide or
                catalog delete controls, if your build exposes them, remove matching rows from the database as implemented
                in that version (often a hard delete for the selection).
              </li>
            </ul>
            <p style={{ margin: 0, lineHeight: 1.65, color: "var(--text-secondary)" }}>
              Copies in server backups, hosting logs, or provider dashboards are outside the app’s control and may
              persist for a period depending on how the deployment is operated. Voice audio for transcription is sent
              to OpenAI for processing and is handled under their retention policies; it is not stored as a persistent
              file by BrainDump for that step unless your deployment adds separate storage.
            </p>
          </section>

          <section style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.65rem" }}>
              Your choices
            </h2>
            <p style={{ margin: 0, lineHeight: 1.65, color: "var(--text-secondary)" }}>
              You can avoid sending specific content to AI by not using organize, coach, transcription/image extraction,
              or suggestion features for that content. For rights requests or questions about a particular hosted
              instance, contact whoever runs that deployment.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
