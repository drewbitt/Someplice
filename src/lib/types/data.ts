import type { Generated } from "kysely"

export interface GoalTable {
    id: Generated<number>
    active: boolean
    orderNumber: number
    title: string
    description: string | null
    color: string | null
}

export interface IntentionTable {
    id: Generated<number>
    goalId: number
    completed: boolean
    text: string
    parentIntentionId: number | null
    subIntentionQualifier: string | null
    date: Date | null
}
