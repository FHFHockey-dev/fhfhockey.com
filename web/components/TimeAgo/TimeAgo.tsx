import React from "react";

import locale from "date-fns/locale/en-US";
import { formatDistanceToNowStrict } from "date-fns";

// https://github.com/date-fns/date-fns/issues/1706#issuecomment-836601089
const formatDistanceLocale: any = {
  lessThanXSeconds: "{{count}}s",
  xSeconds: "{{count}}s",
  halfAMinute: "30s",
  lessThanXMinutes: "{{count}}m",
  xMinutes: "{{count}}m",
  aboutXHours: "{{count}}h",
  xHours: "{{count}}h",
  xDays: "{{count}}d",
  aboutXWeeks: "{{count}}w",
  xWeeks: "{{count}}w",
  aboutXMonths: "{{count}}m",
  xMonths: "{{count}}m",
  aboutXYears: "{{count}}y",
  xYears: "{{count}}y",
  overXYears: "{{count}}y",
  almostXYears: "{{count}}y",
};

function formatDistance(token: string, count: number, options: any) {
  options = options || {};

  const result = formatDistanceLocale[token].replace("{{count}}", count);

  if (options.addSuffix) {
    if (options.comparison > 0) {
      return "in " + result;
    } else {
      return result + " ago";
    }
  }

  return result;
}

type TimeAgoProps = {
  date: string;
};

function TimeAgo({ date }: TimeAgoProps) {
  return (
    <span>
      {formatDistanceToNowStrict(new Date(date), {
        addSuffix: true,
        locale: {
          ...locale,
          formatDistance,
        },
      })}
    </span>
  );
}

export default TimeAgo;
