export interface ExifData {
  make?: string;
  model?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: string;
  focalLength?: string;
  dateTime?: string;
}

export interface Photo {
  id: string;
  url: string;
  name: string;
  exif: ExifData;
}
