// @flow

import ClassName from '../../misc/class-name';

const className = ClassName('calc', 'display');

function splitDigits(digits: string): string[] {
	const result: string[] = [];
	for (let i = 0; i < digits.length; i++) {
		result.push(digits.charAt(i));
	}
	return result;
}

class Digit {
	index: number = -1;
	left: number = 0;
	new: boolean = true;
	deletionDate: ?Date = null;
	text: string;
	top: number = 0;

	constructor(text: string) {
		this.text = text;
	}
}

type TransitionResult = {
	nextDigits: Digit[],
	unusedDigits: Digit[],
};

function isSeparator(text: string): boolean {
	// TODO: Loclaize
	return text === ',';
}

function findReusableOldDigit(oldDigits: Digit[], text: string): number {
	for (let i = 0; i < oldDigits.length; i++) {
		if (oldDigits[i].text === text) {
			return i;
		}
	}
	return -1;
}

function transitDigits(newDigitsText: string, oldDigits: Digit[]): TransitionResult {
	oldDigits = Array.prototype.slice.call(oldDigits);
	oldDigits.forEach((digit) => {
		digit.new = false;
	});

	const oldSeparators = oldDigits.filter((digit) => {
		return isSeparator(digit.text);
	});
	const oldSeparatorCount = oldSeparators.length;

	const nextTexts = splitDigits(newDigitsText);
	const newSeparatorCount = nextTexts.filter(isSeparator).length;

	let separatorIndex: number = 0;
	const nextDigits = nextTexts.map((text, index) => {
		let reusableIndex = -1;
		if (isSeparator(text)) {
			const reversedIndex = (newSeparatorCount - separatorIndex) - 1;
			if (reversedIndex < oldSeparatorCount) {
				reusableIndex = findReusableOldDigit(oldDigits, text);
			}
			++separatorIndex;
		} else {
			reusableIndex = findReusableOldDigit(oldDigits, text);
		}
		if (reusableIndex >= 0) {
			return oldDigits.splice(reusableIndex, 1)[0];
		}

		const newDigit = new Digit(text);
		newDigit.index = index;
		return newDigit;
	});

	return {
		nextDigits,
		unusedDigits: oldDigits,
	};
}

type DisplayDigit = {
	digit: Digit,
	element: HTMLElement,
};

const DELETION_DELAY = 1000;

export default class InnerDisplay {
	elem_: HTMLElement;
	displayDigits_: DisplayDigit[] = [];
	outdatedDisplayDigits_: DisplayDigit[] = [];

	constructor() {
		const elem = document.createElement('div');
		elem.classList.add(className('digitsLayout'));
		this.elem_ = elem;
	}

	updateText(text: string) {
		const {
			nextDigits,
			unusedDigits,
		} = transitDigits(text, this.displayDigits_.map((dd) => {
			return dd.digit;
		}));

		// TODO: Support propotional font
		const displayWidth = this.elem_.getBoundingClientRect().width;
		const digitsWidth = 30 * nextDigits.length;
		const ox = displayWidth - digitsWidth;
		nextDigits.forEach((digit, index) => {
			digit.left = ox + index * 30;
			digit.top = 0;
		});

		// Layout new digits
		const prevDigitElems = this.displayDigits_.map((dd) => {
			return dd.element;
		});
		const nextDigitElems = nextDigits.map((digit) => {
			let digitElem;
			if (!digit.new) {
				digitElem = prevDigitElems[digit.index];
			} else {
				digitElem = document.createElement('span');
				digitElem.classList.add(
					...className('digit', {show: true}).split(' '),
				);
				digitElem.textContent = digit.text;
				this.elem_.appendChild(digitElem);
			}

			digitElem.style.left = `${digit.left}px`;
			digitElem.style.top = `${digit.top}px`;

			return digitElem;
		});

		// Hide unused digits
		const now = new Date();
		unusedDigits.forEach((digit, index) => {
			digit.deletionDate = now;

			const digitElem = prevDigitElems[digit.index];
			const delay = (unusedDigits.length - index - 1) * 0.03;
			digitElem.style.animationDelay = `${delay}s`;
			digitElem.classList.add(
				...className('digit', {hide: true}).split(' '),
			);
		});

		// Remove outdated digits
		this.outdatedDisplayDigits_ = this.outdatedDisplayDigits_.filter((dd) => {
			const {deletionDate} = dd.digit;
			if (!deletionDate) {
				return true;
			}

			const shouldRemove = (now.getTime() - deletionDate.getTime() > DELETION_DELAY);
			if (shouldRemove) {
				dd.element.remove();
			}
			return !shouldRemove;
		});

		// Append outdated digits
		this.outdatedDisplayDigits_.push(
			...unusedDigits.map((digit) => {
				return {
					digit,
					element: this.displayDigits_[digit.index].element,
				};
			}),
		);

		// Store new digits
		this.displayDigits_ = nextDigits.map((digit, index) => {
			digit.index = index;
			return {
				digit,
				element: nextDigitElems[index],
			};
		});
	}

	get element(): HTMLElement {
		return this.elem_;
	}
}