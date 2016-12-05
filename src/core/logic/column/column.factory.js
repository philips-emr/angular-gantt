(function() {
    'use strict';
    angular.module('gantt').factory('GanttColumn', ['moment', function(moment) {
        // Used to display the Gantt grid and header.
        // The columns are generated by the column generator.
        var Column = function(date, endDate, left, width, calendar, timeFramesWorkingMode, timeFramesNonWorkingMode) {
            this.date = date;
            this.endDate = endDate;
            this.left = left;
            this.width = width;
            this.calendar = calendar;
            this.duration = this.endDate.diff(this.date, 'milliseconds');
            this.timeFramesWorkingMode = timeFramesWorkingMode;
            this.timeFramesNonWorkingMode = timeFramesNonWorkingMode;
            this.timeFrames = [];
            this.currentDate = false;
            this.visibleTimeFrames = [];
            this.daysTimeFrames = {};
            this.cropped = false;
            this.originalSize = {left: this.left, width: this.width};
            this.updateTimeFrames();
        };

        var getDateKey = function(date) {
            return date.year() + '-' + date.month() + '-' + date.date();
        };

        Column.prototype.updateView = function() {
            if (this.$element) {
                if (this.currentDate) {
                    this.$element.addClass('gantt-foreground-col-current-date');
                } else {
                    this.$element.removeClass('gantt-foreground-col-current-date');
                }

                this.$element.css({'left': this.left + 'px', 'width': this.width + 'px'});

                for (var i = 0, l = this.timeFrames.length; i < l; i++) {
                    this.timeFrames[i].updateView();
                }
            }
        };

        Column.prototype.updateTimeFrames = function() {
            var self = this;

            if (self.calendar !== undefined && (self.timeFramesNonWorkingMode !== 'hidden' || self.timeFramesWorkingMode !== 'hidden')) {
                var cDate = self.date;
                var cDateStartOfDay = moment(cDate).startOf('day');
                var cDateNextDay = cDateStartOfDay.add(1, 'day');
                var i;
                while (cDate < self.endDate) {
                    var timeFrames = self.calendar.getTimeFrames(cDate);
                    var nextCDate = cDate.add(1,'days');
                    timeFrames = self.calendar.solve(timeFrames, cDate, nextCDate);
                    var cTimeFrames = [];
                    for (i=0; i < timeFrames.length; i++) {
                        var cTimeFrame = timeFrames[i];

                        var start = cTimeFrame.start;
                        if (start === undefined) {
                            start = cDate;
                        }

                        var end = cTimeFrame.end;
                        if (end === undefined) {
                            end = nextCDate;
                        }

                        if (start < self.date) {
                            start = self.date;
                        }

                        if (end > self.endDate) {
                            end = self.endDate;
                        }

                        cTimeFrame = cTimeFrame.clone();

                        cTimeFrame.start = moment(start);
                        cTimeFrame.end = moment(end);

                        cTimeFrames.push(cTimeFrame);
                    }
                    self.timeFrames = self.timeFrames.concat(cTimeFrames);

                    var cDateKey = getDateKey(cDate);
                    self.daysTimeFrames[cDateKey] = cTimeFrames;

                    cDate = nextCDate;
                    cDateStartOfDay = moment(cDate).startOf('day');
                    cDateNextDay = cDateStartOfDay.add(1, 'day');
                }

                for (i=0; i < self.timeFrames.length; i++) {
                    var timeFrame = self.timeFrames[i];

                    var positionDuration = timeFrame.start.diff(self.date, 'milliseconds');
                    var position = positionDuration / self.duration * self.width;

                    var timeFrameDuration = timeFrame.end.diff(timeFrame.start, 'milliseconds');
                    var timeFramePosition = timeFrameDuration / self.duration * self.width;

                    var hidden = false;
                    if (timeFrame.working && self.timeFramesWorkingMode !== 'visible') {
                        hidden = true;
                    } else if (!timeFrame.working && self.timeFramesNonWorkingMode !== 'visible') {
                        hidden = true;
                    }

                    if (!hidden) {
                        self.visibleTimeFrames.push(timeFrame);
                    }

                    timeFrame.hidden = hidden;
                    timeFrame.left = position;
                    timeFrame.width = timeFramePosition;
                    timeFrame.originalSize = {left: timeFrame.left, width: timeFrame.width};
                }

                if (self.timeFramesNonWorkingMode === 'cropped' || self.timeFramesWorkingMode === 'cropped') {
                    var timeFramesWidth = 0;
                    for (var j=0; j < self.timeFrames.length; j++) {
                        var aTimeFrame = self.timeFrames[j];
                        if (!aTimeFrame.working && self.timeFramesNonWorkingMode !== 'cropped' ||
                            aTimeFrame.working && self.timeFramesWorkingMode !== 'cropped') {
                            timeFramesWidth += aTimeFrame.width;
                        }
                    }

                    if (timeFramesWidth !== self.width) {
                        var croppedRatio = self.width / timeFramesWidth;
                        var croppedWidth = 0;
                        var originalCroppedWidth = 0;

                        var allCropped = true;

                        for (j=0; j < self.timeFrames.length; j++) {
                            var bTimeFrame = self.timeFrames[j];

                            if (!bTimeFrame.working && self.timeFramesNonWorkingMode !== 'cropped' ||
                                bTimeFrame.working && self.timeFramesWorkingMode !== 'cropped') {
                                bTimeFrame.left = (bTimeFrame.left - croppedWidth) * croppedRatio;
                                bTimeFrame.width = bTimeFrame.width * croppedRatio;
                                bTimeFrame.originalSize.left = (bTimeFrame.originalSize.left - originalCroppedWidth) * croppedRatio;
                                bTimeFrame.originalSize.width = bTimeFrame.originalSize.width * croppedRatio;
                                bTimeFrame.cropped = false;
                                allCropped = false;
                            } else {
                                croppedWidth += bTimeFrame.width;
                                originalCroppedWidth += bTimeFrame.originalSize.width;
                                bTimeFrame.left = undefined;
                                bTimeFrame.width = 0;
                                bTimeFrame.originalSize = {left: undefined, width: 0};
                                bTimeFrame.cropped = true;
                            }
                        }

                        self.cropped = allCropped;
                    } else {
                        self.cropped = false;
                    }
                }
            }
        };

        Column.prototype.clone = function() {
            return new Column(moment(this.date), moment(this.endDate), this.left, this.width, this.calendar);
        };

        Column.prototype.containsDate = function(date) {
            return date > this.date && date <= this.endDate;
        };

        Column.prototype.equals = function(other) {
            return this.date === other.date;
        };

        Column.prototype.roundTo = function(date, unit, offset, midpoint) {
            // Waiting merge of https://github.com/moment/moment/pull/1794
            if (unit === 'day') {
                // Inconsistency in units in momentJS.
                unit = 'date';
            }

            offset = offset || 1;
            var value = date.get(unit);

            switch (midpoint) {
                case 'up':
                    value = Math.ceil(value / offset);
                    break;
                case 'down':
                    value = Math.floor(value / offset);
                    break;
                default:
                    value = Math.round(value / offset);
                    break;
            }

            var units = ['millisecond', 'second', 'minute', 'hour', 'date', 'month', 'year'];
            date.set(unit, value * offset);

            var indexOf = units.indexOf(unit);
            for (var i = 0; i < indexOf; i++) {
                date.set(units[i], 0);
            }

            return date;
        };

        Column.prototype.getMagnetDate = function(date, magnetValue, magnetUnit, timeFramesMagnet) {
            if (magnetValue > 0 && magnetUnit !== undefined) {
                var initialDate = date;
                date = moment(date);

                if (magnetUnit === 'column') {
                    // Snap to column borders only.
                    var position = this.getPositionByDate(date);

                    if (position < this.width / 2) {
                        date = moment(this.date);
                    } else {
                        date = moment(this.endDate);
                    }
                } else {
                    // Round the value
                    date = this.roundTo(date, magnetUnit, magnetValue);

                    // Snap to column borders if date overflows.
                    if (date < this.date) {
                        date = moment(this.date);
                    } else if (date > this.endDate) {
                        date = moment(this.endDate);
                    }
                }

                if (timeFramesMagnet) {
                    var maxTimeFrameDiff = Math.abs(initialDate.diff(date, 'milliseconds'));
                    var currentTimeFrameDiff;

                    for (var i=0; i<this.timeFrames.length; i++) {
                        var timeFrame = this.timeFrames[i];
                        if (timeFrame.magnet) {
                            var previousTimeFrame = this.timeFrames[i-1];
                            var nextTimeFrame = this.timeFrames[i+1];
                            var timeFrameDiff;

                            if (previousTimeFrame === undefined || previousTimeFrame.working !== timeFrame.working) {
                                timeFrameDiff = Math.abs(initialDate.diff(timeFrame.start, 'milliseconds'));
                                if (timeFrameDiff < maxTimeFrameDiff && (currentTimeFrameDiff === undefined || timeFrameDiff < currentTimeFrameDiff)) {
                                    currentTimeFrameDiff = timeFrameDiff;
                                    date = timeFrame.start;
                                }
                            }

                            if (nextTimeFrame === undefined || nextTimeFrame.working !== timeFrame.working) {
                                timeFrameDiff = Math.abs(initialDate.diff(timeFrame.end, 'milliseconds'));
                                if (timeFrameDiff < maxTimeFrameDiff && (currentTimeFrameDiff === undefined || timeFrameDiff < currentTimeFrameDiff)) {
                                    currentTimeFrameDiff = timeFrameDiff;
                                    date = timeFrame.end;
                                }
                            }
                        }
                    }
                }
            }
            return date;
        };

        Column.prototype.getDateByPositionUsingTimeFrames = function(position) {
            for (var i = 0, l = this.timeFrames.length; i < l; i++) {
                // TODO: performance optimization could be done.
                var timeFrame = this.timeFrames[i];
                if (!timeFrame.cropped && position >= timeFrame.left && position <= timeFrame.left + timeFrame.width) {
                    var positionDuration = timeFrame.getDuration() / timeFrame.width * (position - timeFrame.left);
                    var date = moment(timeFrame.start).add(positionDuration, 'milliseconds');
                    return date;
                }
            }
        };

        Column.prototype.getDateByPosition = function(position, magnetValue, magnetUnit, timeFramesMagnet) {
            var positionDuration;
            var date;

            if (position < 0) {
                position = 0;
            }
            if (position > this.width) {
                position = this.width;
            }

            if (this.timeFramesNonWorkingMode === 'cropped' || this.timeFramesWorkingMode === 'cropped') {
                date = this.getDateByPositionUsingTimeFrames(position);
            }

            if (date === undefined) {
                positionDuration = this.duration / this.width * position;
                date = moment(this.date).add(positionDuration, 'milliseconds');
            }

            date = this.getMagnetDate(date, magnetValue, magnetUnit, timeFramesMagnet);

            return date;
        };

        Column.prototype.getDayTimeFrame = function(date) {
            var dtf = this.daysTimeFrames[getDateKey(date)];
            if (dtf === undefined) {
                return [];
            }
            return dtf;
        };

        Column.prototype.getPositionByDate = function(date) {
            var positionDuration;
            var position;

            if (this.timeFramesNonWorkingMode === 'cropped' || this.timeFramesWorkingMode === 'cropped') {
                var croppedDate = date;
                var timeFrames = this.getDayTimeFrame(croppedDate);
                for (var i = 0; i < timeFrames.length; i++) {
                    var timeFrame = timeFrames[i];
                    if (croppedDate >= timeFrame.start && croppedDate <= timeFrame.end) {
                        if (timeFrame.cropped) {
                            if (timeFrames.length > i + 1) {
                                croppedDate = timeFrames[i + 1].start;
                            } else {
                                croppedDate = timeFrame.end;
                            }
                        } else {
                            positionDuration = croppedDate.diff(timeFrame.start, 'milliseconds');
                            position = positionDuration / timeFrame.getDuration() * timeFrame.width;
                            return this.left + timeFrame.left + position;
                        }
                    }
                }
            }

            positionDuration = date.diff(this.date, 'milliseconds');
            position = positionDuration / this.duration * this.width;

            if (position < 0) {
                position = 0;
            }

            if (position > this.width) {
                position = this.width;
            }

            return this.left + position;
        };

        return Column;
    }]);
}());

