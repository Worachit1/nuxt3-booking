export interface Room {
  name: string;
  description: string;
  capacity: number;
  image_url: File | string; // image_url จะเป็นไฟล์หรือ URL ก็ได้
}