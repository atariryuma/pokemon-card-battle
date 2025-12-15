// Test script to verify image path generation with ID-based system
import { getCardImagePath } from './js/data-manager.js';

// Test data from cards-master.json
const testCards = [
    {
        "id": "01",
        "name_en": "Akamayabato",
        "card_type": "Pokemon"
    },
    {
        "id": "002",
        "name_en": "Cat exv",
        "card_type": "Pokemon"
    },
    {
        "id": "023",
        "name_en": "Colorless Energy",
        "card_type": "Energy",
        "energy_type": "Colorless"
    },
    {
        "id": "024",
        "name_en": "Grass Energy",
        "card_type": "Energy",
        "energy_type": "Grass"
    }
];

console.log("Testing image path generation:");
console.log("=====================================");

testCards.forEach(card => {
    const imagePath = getCardImagePath(card.name_en, card);
    console.log(`Card: ${card.name_en} (ID: ${card.id})`);
    console.log(`Path: ${imagePath}`);
    console.log("-------------------------------------");
});

console.log("Expected ID-based paths:");
console.log("• 01_Akamayabato.webp -> assets/cards/pokemon/01_Akamayabato.webp");
console.log("• 002_Cat_exv.webp -> assets/cards/pokemon/002_Cat_exv.webp");
console.log("• 023_Energy_Colorless.webp -> assets/cards/energy/023_Energy_Colorless.webp");
console.log("• 024_Energy_Grass.webp -> assets/cards/energy/024_Energy_Grass.webp");