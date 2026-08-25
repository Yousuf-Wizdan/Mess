export interface CamuMeal {
  _id: string;
  msCde: string;
  msNme: string;
  mealTm: string;
  mealClr?: string;
  mealNm?: string;
  availFac?: string;
  srvSts?: string;
  srvDte?: string;
}

export interface CamuMenuData {
  facNme?: string;
  oMealList?: CamuMeal[];
  curntDte?: string;
  isAtve?: boolean;
}

export interface CamuMenuResponse {
  output: {
    data: CamuMenuData | null;
    errors: unknown;
  };
}
