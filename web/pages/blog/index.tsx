import { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { TextBanner } from "../../components/Banner/Banner";

const Blog: NextPage = () => {
  return (
    <div>
      <Head>
        <title>FHFH | Blog</title>
      </Head>
      <main>
        <TextBanner text="FHFH Blog" />

        <Link href="/">
          <button>Go Home</button>
        </Link>
      </main>
    </div>
  );
};

export default Blog;
