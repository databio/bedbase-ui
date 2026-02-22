export type PlotSlot =
  | {
      id: string;
      title: string;
      type: 'image';
      thumbnail: string;
      full: string;
    }
  | {
      id: string;
      title: string;
      type: 'observable';
      renderThumbnail: (width: number, height: number) => Element;
      render: (width: number) => Element;
      variants?: { label: string; render: (width: number) => Element }[];
      defaultVariant?: number;
    };
