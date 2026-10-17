import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export const STORE_TIME_ZONE = 'Europe/Prague';
export const isoDay = (date: Date) => format(date, 'yyyy-MM-dd');
export const storeDay = (date: Date) => formatInTimeZone(date, STORE_TIME_ZONE, 'yyyy-MM-dd');
export const daysBetween = (from: Date, to: Date) => differenceInCalendarDays(to, from);
export const plusDays = (date: Date, days: number) => addDays(date, days);
