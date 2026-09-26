/** Report the loudest frequency in a stream every 250 ms. */
export function dominantFrequency(
  ctx: AudioContext,
  stream: MediaStream,
  onValue: (hz: number, levelDb: number) => void,
) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 4096;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const bins = new Float32Array(analyser.frequencyBinCount);
  setInterval(() => {
    analyser.getFloatFrequencyData(bins);
    let best = 0;
    for (let i = 1; i < bins.length; i++) if (bins[i] > bins[best]) best = i;
    onValue((best * ctx.sampleRate) / analyser.fftSize, bins[best]);
  }, 250);
}
