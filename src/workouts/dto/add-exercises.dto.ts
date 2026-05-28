export type AddExercisesDto = {
  exercises: Array<{
    exerciseId: string;
    order: number;
  }>;
};
