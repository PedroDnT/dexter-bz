import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const FEATURE_FILE = resolve(process.cwd(), 'BRAZIL_FEATURES.md');

export function recordBrazilGap(feature: string, note: string): void {
  if (!existsSync(FEATURE_FILE)) return;
  const content = readFileSync(FEATURE_FILE, 'utf-8');
  if (content.includes(feature)) return;

  const marker = '## Best-effort / known gaps';
  if (!content.includes(marker)) return;

  const updated = content.replace(
    marker,
    `${marker}\n- **${feature}**: ${note}`
  );
  writeFileSync(FEATURE_FILE, updated);
}
