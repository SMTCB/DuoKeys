# ADR-010 — optional local score reader. Audiveris (open-source optical music recognition)
# behind a tiny HTTP wrapper. Runs on your own machine; nothing is sent anywhere else.
#
#   docker build -t duokeys-omr tools/omr
#   docker run --rm -p 127.0.0.1:8765:8765 duokeys-omr
#
FROM ubuntu:24.04

# The Audiveris .deb's post-install script fails inside a container, so it is unpacked
# with dpkg-deb instead of installed. GTK is still needed by its start-up code.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl python3 tesseract-ocr tesseract-ocr-eng \
      libfreetype6 libxrender1 libxtst6 libxi6 libfontconfig1 libgtk-3-0t64 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

ARG AUDIVERIS_VERSION=5.11.0
RUN curl -fsSL -o /tmp/audiveris.deb \
      "https://github.com/Audiveris/audiveris/releases/download/${AUDIVERIS_VERSION}/Audiveris-${AUDIVERIS_VERSION}-ubuntu24.04-x86_64.deb" \
    && dpkg-deb -x /tmp/audiveris.deb / \
    && rm /tmp/audiveris.deb

ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
COPY server.py /app/server.py
WORKDIR /work
EXPOSE 8765
CMD ["python3", "/app/server.py"]
