import type { CamuMenuResponse } from "@/types/camu";
import { MenuSnapshot } from "@/types/menu";
import { mapCamuMenu } from "@/lib/camu-map";

const FIXTURE_RAW: CamuMenuResponse = {
  output: {
    data: {
      facNme: "Ground Floor",
      curntDte: "2026-08-25T04:35:00Z",
      isAtve: true,
      oMealList: [
        {
          _id: "b1",
          msCde: "Breakfast(Tue)",
          mealTm: "Breakfast 07:30 AM - 09:30 AM",
          mealClr: "#fcb900",
          mealNm: "Tuesday",
          availFac: "Ground Floor",
          srvSts: "S",
          srvDte: "09:30 AM",
          msNme:
            "Besan Chilla - (180 Kcal)\nGreen Chutney-(90Kcal)\nSweet Lime - (43 Kcal)\nBoiled Eggs (2 pc)- (155 Kcal)\nMasala Chai - (60 Kcal)",
        },
        {
          _id: "l1",
          msCde: "Lunch(Tue)",
          mealTm: "Lunch 12:30 PM - 02:30 PM",
          mealClr: "#34a853",
          mealNm: "Tuesday",
          availFac: "Ground Floor",
          srvSts: "P",
          msNme:
            "Rajma Curry - (210 Kcal)\nJeera Rice - (250 Kcal)\nTandoori Roti (2 pc) - (240 Kcal)\nMix Veg Sabzi - (130 Kcal)\nPapad - (45 Kcal)\nBoondi Raita - (110 Kcal)",
        },
        {
          _id: "s1",
          msCde: "Snack(Tue)",
          mealTm: "Snack 05:00 PM - 06:00 PM",
          mealClr: "#a855f7",
          mealNm: "Tuesday",
          availFac: "Ground Floor",
          srvSts: "P",
          msNme:
            "Veg Sandwich - (220 Kcal)\nTomato Ketchup - (20 Kcal)\nCoffee - (80 Kcal)",
        },
        {
          _id: "d1",
          msCde: "Dinner(Tue)",
          mealTm: "Dinner 07:30 PM - 09:30 PM",
          mealClr: "#ef4444",
          mealNm: "Tuesday",
          availFac: "Ground Floor",
          srvSts: "P",
          msNme:
            "Paneer Butter Masala - (320 Kcal)\nButter Naan (2 pc) - (280 Kcal)\nDal Tadka - (180 Kcal)\nSteamed Rice - (200 Kcal)\nGulab Jamun (1 pc) - (150 Kcal)",
        },
      ],
    },
    errors: null,
  },
};

export const MENU_FIXTURE: MenuSnapshot = mapCamuMenu(
  FIXTURE_RAW,
  new Date("2026-08-25T04:40:00Z"),
);
