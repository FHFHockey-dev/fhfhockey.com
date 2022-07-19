/**
 * dd/mm/yyyy hh:mm(am/pm) <TimeZone Abbrivation>
 * @param str ISO string of a date
 */
export default function formatDate(str: string) {
  const date = new Date(str);

  // hh:mm(am/pm)
  const time = date.toLocaleTimeString().split(" ").join("").toLowerCase();
  const result = `${date.toLocaleDateString("en-US")} ${time}`;

  return result;
}
