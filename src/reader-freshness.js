export function latestAmendmentMarker(text) {
  const dates = [...String(text).matchAll(/(\d{4})\.(\d{1,2})\.(\d{1,2})/g)]
    .map((match) => ({
      value: Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    }))
    .filter((date) => Number.isFinite(date.value));

  if (dates.length === 0) return null;
  const latest = dates.sort((left, right) => right.value - left.value)[0];
  return {
    isoDate: `${latest.year}-${pad(latest.month)}-${pad(latest.day)}`,
    displayDate: `${latest.year}. ${latest.month}. ${latest.day}.`,
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}
