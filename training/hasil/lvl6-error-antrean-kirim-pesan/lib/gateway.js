// Stand-in for the WhatsApp gateway. Do not change how it behaves.
export const deliveries = [];

export async function send(job) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (job.to.startsWith('gagal')) throw new Error('Nomor gak aktif');
  // Flaky number: the first try times out, the next one goes through.
  if (job.to.startsWith('kadang') && !deliveries.some((d) => d.failedOnce === job.id)) {
    deliveries.push({ failedOnce: job.id });
    throw new Error('Timeout');
  }
  deliveries.push({ jobId: job.id, to: job.to });
}
