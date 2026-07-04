.PHONY: run test

run:
	cd backend && ./start.sh

test:
	cd tests && python3 -m pytest
