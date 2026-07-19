import { readFileSync } from 'node:fs';

const path = '/home/ubuntu/pokedex-index/pokedex-x-thread.md';
const markdown = readFileSync(path, 'utf8');
const section = markdown.split('## Thread\n\n')[1].split('\n\n---\n\n## Source Links Used')[0];
const matches = [...section.matchAll(/\*\*(\d+\/15)\*\*\n\n([\s\S]*?)(?=\n\n\*\*\d+\/15\*\*|$)/g)];

for (const [, label, raw] of matches) {
  const post = raw.replace(/\n+/g, ' ').trim();
  console.log(`${label}\t${[...post].length}\t${post}`);
}
