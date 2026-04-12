/* eslint-disable @next/next/no-img-element */
import React from "react";
import type { GetStaticProps } from "next";
import { NextSeo } from "next-seo";

import { TextBanner } from "../components/Banner/Banner";
import Container from "components/Layout/Container";

import styles from "styles/Podfeed.module.scss";

const PODCAST_FEED_URL = "https://feed.podbean.com/fhfhradio/feed.xml";
const YOUTUBE_FEED_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCkOupTrhM1Ob_xzdSPuwJdQ";
const MAX_EPISODES = 30;

type YoutubeVideo = {
  episodeNumber: string | null;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  publishedLabel: string;
};

type PodcastEpisode = {
  id: string;
  episodeNumber: string | null;
  title: string;
  description: string;
  publishedLabel: string;
  durationLabel: string | null;
  audioUrl: string;
  episodeUrl: string;
  youtubeVideo: YoutubeVideo | null;
};

type PodfeedProps = {
  episodes: PodcastEpisode[];
  feedError: string | null;
};

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"');
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function extractTag(block: string, tagName: string): string | null {
  const escapedTagName = tagName.replace(":", "\\:");
  const match = block.match(
    new RegExp(`<${escapedTagName}[^>]*>([\\s\\S]*?)<\\/${escapedTagName}>`)
  );

  return match ? decodeXml(stripCdata(match[1].trim())) : null;
}

function extractAttribute(
  block: string,
  tagName: string,
  attributeName: string
): string | null {
  const escapedTagName = tagName.replace(":", "\\:");
  const tagMatch = block.match(new RegExp(`<${escapedTagName}[^>]*>`));
  if (!tagMatch) return null;

  const attrMatch = tagMatch[0].match(
    new RegExp(`${attributeName}=["']([^"']+)["']`)
  );

  return attrMatch ? decodeXml(attrMatch[1]) : null;
}

function stripHtml(value: string): string {
  return decodeXml(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatDuration(value: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (/^\d+:\d{2}(?::\d{2})?$/.test(trimmed)) return trimmed;

  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function extractEpisodeNumber(title: string): string | null {
  const match = title.match(/\bFHFH\s+(\d{2,4})\b/i);
  return match ? match[1] : null;
}

function splitXmlItems(xml: string, itemTag: "item" | "entry"): string[] {
  return xml.split(
    new RegExp(`<${itemTag}[\\s>][\\s\\S]*?<\\/${itemTag}>`, "g")
  ).length > 1
    ? (xml.match(
        new RegExp(`<${itemTag}[\\s>][\\s\\S]*?<\\/${itemTag}>`, "g")
      ) ?? [])
    : [];
}

function parseYoutubeFeed(xml: string): YoutubeVideo[] {
  return splitXmlItems(xml, "entry").map((entry) => {
    const title = extractTag(entry, "title") ?? "Untitled video";
    const videoId = extractTag(entry, "yt:videoId");
    const url =
      extractAttribute(entry, "link", "href") ??
      (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");

    return {
      episodeNumber: extractEpisodeNumber(title),
      title,
      url,
      thumbnailUrl: extractAttribute(entry, "media:thumbnail", "url"),
      publishedLabel: formatDate(extractTag(entry, "published"))
    };
  });
}

function parsePodcastFeed(xml: string, youtubeVideos: YoutubeVideo[]) {
  const youtubeByEpisode = new Map(
    youtubeVideos
      .filter((video) => video.episodeNumber)
      .map((video) => [video.episodeNumber, video])
  );

  return splitXmlItems(xml, "item")
    .slice(0, MAX_EPISODES)
    .map((item) => {
      const title = extractTag(item, "title") ?? "Untitled episode";
      const episodeNumber =
        extractTag(item, "itunes:episode") ?? extractEpisodeNumber(title);
      const description = stripHtml(
        extractTag(item, "itunes:summary") ??
          extractTag(item, "description") ??
          ""
      );

      return {
        id: extractTag(item, "guid") ?? title,
        episodeNumber,
        title,
        description,
        publishedLabel: formatDate(extractTag(item, "pubDate")),
        durationLabel: formatDuration(extractTag(item, "itunes:duration")),
        audioUrl: extractAttribute(item, "enclosure", "url") ?? "",
        episodeUrl: extractTag(item, "link") ?? "https://fhfhradio.podbean.com",
        youtubeVideo: episodeNumber
          ? (youtubeByEpisode.get(episodeNumber) ?? null)
          : null
      };
    })
    .filter((episode) => episode.audioUrl);
}

export const getStaticProps: GetStaticProps<PodfeedProps> = async () => {
  try {
    const [podcastResponse, youtubeResponse] = await Promise.all([
      fetch(PODCAST_FEED_URL),
      fetch(YOUTUBE_FEED_URL)
    ]);

    if (!podcastResponse.ok) {
      throw new Error(`Podcast feed returned ${podcastResponse.status}`);
    }

    const podcastXml = await podcastResponse.text();
    const youtubeXml = youtubeResponse.ok ? await youtubeResponse.text() : "";
    const youtubeVideos = youtubeXml ? parseYoutubeFeed(youtubeXml) : [];

    return {
      props: {
        episodes: parsePodcastFeed(podcastXml, youtubeVideos),
        feedError: youtubeResponse.ok ? null : "YouTube feed unavailable."
      },
      revalidate: 60 * 60
    };
  } catch (error) {
    console.error("Failed to load podcast feed:", error);

    return {
      props: {
        episodes: [],
        feedError: "Podcast feed unavailable."
      },
      revalidate: 15 * 60
    };
  }
};

function Podfeed({ episodes, feedError }: PodfeedProps) {
  return (
    <Container>
      <NextSeo
        title="FHFH | Podcast"
        description="Listen to recent Five Hole Fantasy Hockey podcast episodes."
      />

      <TextBanner text="" />

      <section className={styles.pageIntro}>
        <p>FHFH Podcast Library</p>
        <div className={styles.feedLinks}>
          <a href={PODCAST_FEED_URL}>RSS Feed</a>
          <a href="https://fhfhradio.podbean.com">Podbean</a>
          <a href="https://www.youtube.com/c/FiveHoleFantasyHockey">YouTube</a>
        </div>
      </section>

      {feedError && <p className={styles.feedError}>{feedError}</p>}

      <section className={styles.episodeList} aria-label="Podcast episodes">
        {episodes.map((episode) => (
          <article key={episode.id} className={styles.episodeCard}>
            <div className={styles.episodeContent}>
              <div className={styles.episodeMeta}>
                <span>{episode.publishedLabel}</span>
                {episode.durationLabel && <span>{episode.durationLabel}</span>}
                {episode.episodeNumber && (
                  <span>Episode {episode.episodeNumber}</span>
                )}
              </div>

              <h2>{episode.title}</h2>

              {episode.description && <p>{episode.description}</p>}

              <audio
                className={styles.audioPlayer}
                controls
                preload="none"
                src={episode.audioUrl}
              >
                <a href={episode.audioUrl}>Download audio</a>
              </audio>

              <div className={styles.episodeActions}>
                <a href={episode.episodeUrl}>Open episode</a>
                {episode.youtubeVideo ? (
                  <a href={episode.youtubeVideo.url}>Watch on YouTube</a>
                ) : (
                  <span>No matched YouTube upload</span>
                )}
              </div>
            </div>

            {episode.youtubeVideo?.thumbnailUrl && (
              <a
                className={styles.youtubePreview}
                href={episode.youtubeVideo.url}
                aria-label={`Watch ${episode.youtubeVideo.title} on YouTube`}
              >
                <img
                  src={episode.youtubeVideo.thumbnailUrl}
                  alt=""
                  loading="lazy"
                />
                <span>{episode.youtubeVideo.title}</span>
              </a>
            )}
          </article>
        ))}
      </section>
    </Container>
  );
}

export default Podfeed;
