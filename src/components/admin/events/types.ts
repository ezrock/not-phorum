export interface SiteEvent {
  id: number;
  name: string;
  event_date: string;
  repeats_yearly: boolean;
  date_range_enabled: boolean;
  range_start_date: string | null;
  range_end_date: string | null;
  music_enabled: boolean;
  music_file: string | null;
  logo_enabled: boolean;
  logo_file: string | null;
}

export interface EventFormState {
  name: string;
  eventDate: string;
  repeatsYearly: boolean;
  dateRangeEnabled: boolean;
  rangeStartDate: string;
  rangeEndDate: string;
  musicEnabled: boolean;
  musicFile: string;
  logoEnabled: boolean;
  logoFile: string;
}

export const EMPTY_FORM: EventFormState = {
  name: '',
  eventDate: '',
  repeatsYearly: true,
  dateRangeEnabled: false,
  rangeStartDate: '',
  rangeEndDate: '',
  musicEnabled: false,
  musicFile: '',
  logoEnabled: false,
  logoFile: '',
};
