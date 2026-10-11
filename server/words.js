export const defaultWords = [
  "apple", "banana", "cat", "dog", "elephant", "fish", "guitar", "house",
  "ice cream", "jungle", "kite", "lion", "monkey", "night", "ocean",
  "piano", "queen", "robot", "sun", "tree", "umbrella", "volcano",
  "water", "xylophone", "yacht", "zebra", "astronaut", "balloon", "castle",
  "dragon", "eagle", "fire", "ghost", "helicopter", "island", "jellyfish",
  "kangaroo", "lighthouse", "moon", "ninja", "octopus", "penguin", "quilt",
  "rocket", "snake", "train", "unicorn", "vampire", "whale", "x-ray",
  "yoyo", "zombie", "mountain", "river", "forest", "desert", "beach",
  "computer", "phone", "book", "car", "bus", "train", "airplane",
  "pizza", "burger", "salad", "cake", "cookie", "coffee", "tea"
];

export function getRandomWords(count, wordList = defaultWords) {
  const shuffled = [...wordList].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
