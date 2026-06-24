export const fmtD = d => d ? `${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(2,4)}` : '—';

export const fmtDT = d => {
  if (!d) return '—';
  return `${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(2,4)} ${d.slice(11,16)}`;
};
