export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    monthly_budget: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    monthly_budget?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    monthly_budget?: number | null
                    created_at?: string
                    updated_at?: string
                }
            }
            categories: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    type: 'expense' | 'income'
                    icon: string | null
                    color: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    type?: 'expense' | 'income'
                    icon?: string | null
                    color?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    type?: 'expense' | 'income'
                    icon?: string | null
                    color?: string | null
                    created_at?: string
                }
            }
            transactions: {
                Row: {
                    id: string
                    user_id: string
                    amount: number
                    date: string
                    store_name: string | null
                    item_name: string | null
                    category_id: string | null

                    memo: string | null
                    receipt_image_url: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    amount: number
                    date: string
                    store_name?: string | null
                    item_name?: string | null
                    category_id?: string | null

                    memo?: string | null
                    receipt_image_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    amount?: number
                    date?: string
                    store_name?: string | null
                    item_name?: string | null
                    category_id?: string | null

                    memo?: string | null
                    receipt_image_url?: string | null
                    created_at?: string
                }
            }
            fixed_costs: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    amount: number
                    date_of_month: number
                    category_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string
                    name: string
                    amount: number
                    date_of_month: number
                    category_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    amount?: number
                    date_of_month?: number
                    category_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
        }
    }
}
