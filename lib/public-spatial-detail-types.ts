export interface PublicSpatialPerson {
  id: number;
  name: string;
  subtitle: string | null;
  profilePath: string | null;
}

export interface PublicSpatialProvider {
  id: number;
  name: string;
  logoPath: string;
}

export interface PublicSpatialTitleDetail {
  summary: string | null;
  tagline: string | null;
  trailerKey: string | null;
  directedBy: string[];
  cast: PublicSpatialPerson[];
  crew: PublicSpatialPerson[];
  watchProviders: {
    link: string;
    providers: PublicSpatialProvider[];
  } | null;
}
