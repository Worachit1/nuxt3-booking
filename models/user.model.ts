export interface User {
    id?: string;
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    position_name: string;
    phone: string;
    image_url: File | string;
    role_name: string;
    token?: string;
}