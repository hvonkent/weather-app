export type City = {
  slug: string;
  name: string;
  location: string;
  timeZone: string;
};

export const cities: City[] = [
  {
    slug: "amsterdam",
    name: "Amsterdam",
    location: "Netherlands",
    timeZone: "Europe/Amsterdam",
  },
  {
    slug: "bremen",
    name: "Bremen",
    location: "Germany",
    timeZone: "Europe/Berlin",
  },
  {
    slug: "munich",
    name: "Munich",
    location: "Germany",
    timeZone: "Europe/Berlin",
  },
  {
    slug: "rochester_mn",
    name: "Rochester",
    location: "Minnesota, USA",
    timeZone: "America/Chicago",
  },
  {
    slug: "boston_ma",
    name: "Boston",
    location: "Massachusetts, USA",
    timeZone: "America/New_York",
  },
];

export function getCity(
  slug: string
) {
  return cities.find(
    (city) =>
      city.slug === slug
  );
}