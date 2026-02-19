export type PlotSlot =
  | {
      id: string;
      title: string;
      type: 'vega';
      spec: Record<string, unknown>; // thumbnail spec (compact)
      buildFullSpec: (width: number) => Record<string, unknown>; // full-size spec builder
    }
  | {
      id: string;
      title: string;
      type: 'image';
      thumbnail: string;
      full: string;
    };
