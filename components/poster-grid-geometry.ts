/**
 * Shared poster geometry for catalogue surfaces that visually join the
 * Library shelf. Keeping these values together prevents Discover from
 * drifting to a separate card size as responsive breakpoints evolve.
 */
export const LIBRARY_POSTER_GRID_CLASS_NAME =
  "grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10";

export const LIBRARY_POSTER_RAIL_CLASS_NAME =
  "grid min-w-0 w-full shrink-0 grid-flow-col auto-cols-[calc((100%_-_1.5rem)/4)] gap-x-2 sm:auto-cols-[calc((100%_-_2.5rem)/3)] sm:gap-x-5 md:auto-cols-[calc((100%_-_3.75rem)/4)] lg:auto-cols-[calc((100%_-_5rem)/5)] xl:auto-cols-[calc((100%_-_5rem)/5)] 2xl:auto-cols-[calc((100%_-_6.25rem)/6)] 3xl:auto-cols-[calc((100%_-_7.5rem)/7)] 4xl:auto-cols-[calc((100%_-_8.75rem)/8)] 5xl:auto-cols-[calc((100%_-_10rem)/9)] 6xl:auto-cols-[calc((100%_-_11.25rem)/10)]";

/**
 * The standard app shell and immersive Library use slightly different page
 * padding. This scoped correction gives non-chat Discover surfaces the same
 * physical content gutter without changing the shared app shell.
 */
export const LIBRARY_CONTENT_GUTTER_CLASS_NAME =
  "-mx-1 w-[calc(100%+0.5rem)] sm:mx-0 sm:w-full md:-mx-1 md:w-[calc(100%+0.5rem)] lg:-mx-2 lg:w-[calc(100%+1rem)] xl:mx-0 xl:w-full";
