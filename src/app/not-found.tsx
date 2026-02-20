import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="layout-center-screen-offset-header">
      <div className="text-center">
        <pre className="text-gray-800 leading-tight text-[0.45rem] sm:text-[0.55rem] md:text-xs overflow-hidden text-left inline-block">{
`___________                      __     ________
\\_   _____/______   ____ _____  |  | __ \\_____  \\   ____
 |    __) \\_  __ \\_/ __ \\\\__  \\ |  |/ /  /   |   \\ /    \\
 |     \\   |  | \\/\\  ___/ / __ \\|    <  /    |    \\   |  \\
 \\___  /   |__|    \\___  >____  /__|_ \\ \\_______  /___|  /
     \\/                \\/     \\/     \\/         \\/     \\/
_______________  _______      _____
\\_____  \\   _  \\ \\   _  \\    /  |  |
 /  ____/  /_\\  \\/  /_\\  \\  /   |  |_  ______
/       \\  \\_/   \\  \\_/   \\/    ^   / /_____/
\\_______ \\_____  /\\_____  /\\____   |
        \\/     \\/       \\/      |__|`
        }</pre>

        <h2 className="text-6xl font-bold text-gray-800 mt-8 mb-4">404</h2>
        <p className="text-xl text-gray-600 mb-8">Sivua ei löytynyt</p>

        <Link
          href="/"
          className="inline-block px-6 py-3 bg-gray-800 text-yellow-400 font-bold rounded hover:bg-gray-700 transition"
        >
          Etusivulle
        </Link>
      </div>
    </div>
  );
}
