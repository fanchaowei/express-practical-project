-- CreateIndex
CREATE INDEX "images_movieId_idx" ON "images"("movieId");

-- CreateIndex
CREATE INDEX "movies_type_idx" ON "movies"("type");

-- CreateIndex
CREATE INDEX "movies_rating_idx" ON "movies"("rating");

-- CreateIndex
CREATE INDEX "movies_releaseYear_idx" ON "movies"("releaseYear");

-- CreateIndex
CREATE INDEX "movies_createdAt_idx" ON "movies"("createdAt");
