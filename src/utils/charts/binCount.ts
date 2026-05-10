export function binData(data: number[], bins: number) {
  if (data.length === 0 || bins <= 0) {
    return [];
  }

  const minimum = Math.min(...data);
  const maximum = Math.max(...data);
  const range = maximum - minimum;
  const binSize = range === 0 ? 1 : (range * 1.01) / bins;
  // console.log(`data ranges from ${minimum} to ${maximum}, binsize ${binSize}`);
  // Count occurances an array with [bucketStart, count in this bucket]
  const baseBins = [...Array(bins).keys()].map((i) => [
    Math.round((minimum + i * binSize) * 1000) / 1000,
    0,
  ]);

  // console.log(baseBins);
  for (let i = 0; i < data.length; i++) {
    const index = Math.min(Math.floor((data[i]! - minimum) / binSize), bins - 1);
    if (!isNaN(index)) {
      baseBins[index]![1]!++;
    }
  }

  return baseBins;
}
