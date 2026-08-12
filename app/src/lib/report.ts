import type { ReminderRule } from '../db/types';

// Pure markdown builder for the vet report — no i18n, no platform imports,
// unit-tested. The screen translates labels and pre-formats dates, then
// feeds plain data in; this module only shapes the document.

export interface ReportLine {
  at: string; // pre-formatted date
  text: string;
}

export interface ReportData {
  petName: string;
  periodLabel: string; // e.g. "Last 30 days"
  weights: ReportLine[];
  checkins: ReportLine[];
  symptoms: ReportLine[];
  meds: ReportLine[];
  vaccines: ReportLine[];
  visits: ReportLine[];
  upcoming: ReportLine[]; // reminder rules with next due
}

export interface ReportLabels {
  title: string; // "{name} — Pawly vet report"
  weight: string;
  checkins: string;
  symptoms: string;
  meds: string;
  vaccines: string;
  visits: string;
  upcoming: string;
}

// Renders a user-typed title safely inside a markdown line.
function clean(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').trim();
}

function section(lines: ReportLine[]): string {
  if (lines.length === 0) {
    return '—';
  }
  return lines.map((l) => `- ${l.at}: ${clean(l.text)}`).join('\n');
}

export function reportMarkdown(data: ReportData, labels: ReportLabels): string {
  const parts = [
    `# ${labels.title}`,
    data.periodLabel,
    '',
    `## ${labels.weight}`,
    section(data.weights),
    '',
    `## ${labels.checkins}`,
    section(data.checkins),
    '',
    `## ${labels.symptoms}`,
    section(data.symptoms),
    '',
    `## ${labels.meds}`,
    section(data.meds),
    '',
    `## ${labels.vaccines}`,
    section(data.vaccines),
    '',
    `## ${labels.visits}`,
    section(data.visits),
    '',
    `## ${labels.upcoming}`,
    section(data.upcoming),
    '',
  ];
  return parts.join('\n');
}

export type { ReminderRule };
