const handler = async function () {

  const data = [
    ['0x1cdad9984a7b86ea02768bfc75351fef9baa398e085cf9d66863cb1b71f9936c', 528],
    ['0x56d2f79c44b2ea8db86b3092258f2a1580810540434f9f782e674807a2a8ac15', 3040],
    ['0xd67aa113d56b54fcd8bf27e19d7c03c4d9239c8125f9049f90e900a121dd63ac', 83659],
    ['0x6b654f32e0b2985a83066d37a5f8665fc8691ffd9672af177539444acf48ecab', 280],
    ['0xac6254decf9ccb1d41943a4f7db9b959900b5144164a388034d79aefe08b7cdf', 355],
    ['0xec86f014a0063de7488c1a0aecdf85955619c638293609c739b09349eae44be1', 242],
    ['0x332a4e4ae2a9a3c8e1199cfbe0ce6134b842ba12776bd13d590fd83936520353', 118],
    ['0xa09735110931a6fea998fcc2384d5bfdd9e0a157e6d63718ce3d231319abee7b', 207],
    ['0x7634ea5c552539e617b02ff402dd4047248d445692156c75cdbffbd811301014', 450],
    ['0x27d1b764f4d1c618c9807ab5d762418f4d0849a5ae61d81ee9eb40232b73a47a', 232],
    ['0xf40e10e49017a4f2223b04b97a5cc7e2242d7e7998ac7edb34ce3bd1b29b056a', 129671],
    ['0xb33dd2ca75dca69761fcb7662368e04c82bfb70f7a4cd90d6eba181a965d9bdb', 325],
    ['0xf21f97dc165b35d31697765e14a1cdbd999b59d57a5e870f63afb5df7a675e31', 71],
    ['0x4597d7f97fa1f9b53093a80f03aa5c3faab9b369d0f1f8667e0cd022671ab4e9', 2873],
    ['0x288e156f652630294b212225ebb9151730c92efed7fd390d9f5b12cba75adccb', 431],
    ['0x7a886ad75e0f42b2a566a73a5922ebd423ae89c93ad6e4eed0be5021484ba1b7', 71],
    ['0xd938418eb0825ef5c969a8e27ff4196a76bf2314afbec6a8c96593906c8f00cc', 359],
    ['0x2bb976b18ec0d172d5e8bd61ae81d7b5b0dcf9b7e03384065062270da380529f', 323],
    ['0xfc3b13f7ca1eec1e7557f7c7d799e6382093ca6102cfc64b252c64f8856ed0f7', 189],
    ['0xeb42e96b64a7a7903545c7274c4c4bb450f0775c3ead3709783519ad21590750', 1206],
    ['0x0abc8550f3d4f097fa8ecd96976fc4e67a5df96c26e5f60a8e06dd42554ab06a', 157],
    ['0x1a3f99570f98317f39c9c6cf8a22543f429eb76aa5e56aa0ab516466fb15c4d1', 40000]
  ];

  // Storage for our flat array.
  let out = [];

// Loop through the master entries.
  for (let i = 0; i < data.length; ++i) {
    // Push the value over and over again according to its
    // weight.
    for (let j = 0; j < data[i][1]; ++j) {
      out.push(data[i][0]);
    }
  }

// And done!
  console.log(out[Math.floor(Math.random() * out.length)]);


};

handler()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
