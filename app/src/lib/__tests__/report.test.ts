import { describe, expect, it } from 'vitest';
import { reportMarkdown, type ReportData, type ReportLabels } from '../report';

const labels: ReportLabels = {
  title: 'Milo — Pawly vet report',
  weight: 'Weight',
  checkins: 'Mood & appetite',
  symptoms: 'Symptoms',
  meds: 'Medications given',
  vaccines: 'Vaccine status',
  visits: 'Vet visits',
  upcoming: 'Upcoming reminders',
};

const data: ReportData = {
  petName: 'Milo',
  periodLabel: 'Last 30 days · Aug 12, 2026',
  weights: [{ at: 'Aug 12, 2026', text: '4.2 kg' }],
  checkins: [],
  symptoms: [{ at: 'Aug 10, 2026', text: 'Itchy ears' }],
  meds: [],
  vaccines: [{ at: 'Jun 1, 2026', text: 'Rabies' }],
  visits: [],
  upcoming: [{ at: 'Aug 20, 2026', text: 'Flea treatment' }],
};

describe('reportMarkdown', () => {
  it('starts with the title and period', () => {
    const md = reportMarkdown(data, labels);
    const lines = md.split('\n');
    expect(lines[0]).toBe('# Milo — Pawly vet report');
    expect(lines[1]).toBe('Last 30 days · Aug 12, 2026');
  });

  it('lists every non-empty section with its lines', () => {
    const md = reportMarkdown(data, labels);
    expect(md).toContain('## Weight\n- Aug 12, 2026: 4.2 kg');
    expect(md).toContain('## Symptoms\n- Aug 10, 2026: Itchy ears');
    expect(md).toContain('## Vaccine status\n- Jun 1, 2026: Rabies');
    expect(md).toContain('## Upcoming reminders\n- Aug 20, 2026: Flea treatment');
  });

  it('renders an em dash for empty sections', () => {
    const md = reportMarkdown(data, labels);
    expect(md).toContain('## Mood & appetite\n—');
    expect(md).toContain('## Medications given\n—');
    expect(md).toContain('## Vet visits\n—');
  });

  it('collapses newlines inside user text', () => {
    const md = reportMarkdown(
      { ...data, symptoms: [{ at: 'Aug 10, 2026', text: 'Line one\nLine two' }] },
      labels
    );
    expect(md).toContain('- Aug 10, 2026: Line one Line two');
  });
});
