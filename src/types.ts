export type Habit = {
  id: string
  name: string
  created_at: string
  habit_logs: { done_on: string }[]
}
