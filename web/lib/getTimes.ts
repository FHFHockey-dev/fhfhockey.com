import { TimeOption } from "components/TimeOptions/TimeOptions";
import { format, subDays } from "date-fns";

type Times = {
  /**
   * yyyy-MM-dd
   */
  StartTime: string | null;

  /**
   * yyyy-MM-dd
   */
  EndTime: string | null;
};

/**
 *  Get the range of the time option.
 * - If the `timeOption` is __SEASON__, return null for both Start/End Time.
 * @param timeOption A time option
 */
export default function getTimes(timeOption: TimeOption): Times {
  let startTime: Date;
  let endTime: Date;
  switch (timeOption) {
    case "L5": {
      startTime = subDays(new Date(), 5);
      endTime = new Date();
      break;
    }
    case "L10": {
      startTime = subDays(new Date(), 10);
      endTime = new Date();
      break;
    }
    case "L20": {
      startTime = subDays(new Date(), 20);
      endTime = new Date();
      break;
    }
    case "3YA": {
      startTime = subDays(new Date(), 365 * 3);
      endTime = new Date();
      break;
    }
    case "L5": {
      startTime = subDays(new Date(), 5);
      endTime = new Date();
      break;
    }
    case "L7": {
      startTime = subDays(new Date(), 7);
      endTime = new Date();
      break;
    }
    case "L14": {
      startTime = subDays(new Date(), 14);
      endTime = new Date();
      break;
    }
    case "L30": {
      startTime = subDays(new Date(), 30);
      endTime = new Date();
      break;
    }
    case "SEASON": {
      break;
    }
    default:
      throw new Error("This time option is not implemented.");
  }

  return {
    StartTime:
      // @ts-ignore
      timeOption === "SEASON" ? null : format(startTime, "yyyy-MM-dd"),
    EndTime:
      // @ts-ignore
      timeOption === "SEASON" ? null : format(endTime, "yyyy-MM-dd"),
  };
}
