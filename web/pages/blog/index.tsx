import { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";

const Blog: NextPage = () => {
  return (
    <div>
      <Head>
        <title>FHFH | Blog</title>
      </Head>
      <main>
        <h1>FHFH Blog</h1>

        <Link href="/">
          <button>Go Home</button>
        </Link>
      </main>
    </div>
  );
};

export default Blog;
