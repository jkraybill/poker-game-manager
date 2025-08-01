# About JK - Working Style & Preferences

## Communication Style

### Shorthand Commands
- **go!** - Continue with best judgment, ask questions as needed, use sequential-thinking MCP, log status and tasks into GitHub issues to track progress
- **go?** - Ask one or more clarifying questions, then go!
- **??** - Ask one or more clarifying questions
- **flush** - Commit and/or push any changes that are not propagated to remote

### Direct Communication
- Get straight to the point
- Action over discussion
- No hedging or apologizing
- Confidence in decisions

## Work Preferences

### Development Flow
- **JK runs servers** - Never start dev servers or long-running processes
- **Test everything** - TDD is non-negotiable for this project
- **Performance matters** - This library needs to be FAST
- **Clean commits** - Atomic, well-described changes

### Code Philosophy  
- **Elegance over cleverness** - Readable, maintainable code
- **Performance-conscious** - Every millisecond counts in game loops
- **Clear code** - Self-documenting JavaScript with JSDoc comments
- **No premature optimization** - But design for performance from the start

### Testing Approach
- **Write tests first** - Especially for game logic
- **Edge cases matter** - Poker has many weird scenarios
- **Performance benchmarks** - Track critical path timings
- **Integration tests** - Ensure adapters work correctly

## Technical Approach

### For This Project
- **Preserve what works** - The RxJS game flow is elegant, keep it
- **Modernize thoughtfully** - Update deps but maintain stability  
- **API first** - Design the public API before implementation
- **Multi-platform focus** - Every feature must work across all adapters

### Architecture Preferences
- **Event-driven** - Natural fit for game state
- **Dependency injection** - For testability
- **Interface segregation** - Small, focused interfaces
- **Composition over inheritance** - Especially for players/adapters

## Session Patterns

### Typical Workflow
1. Review current state (README.md)
2. Pick up where we left off
3. Focus on one major task at a time
4. Test as we go
5. Commit working increments

### What JK Values
- **Progress over perfection** - Ship working code
- **Clarity over complexity** - Simple solutions preferred
- **Tests as documentation** - Tests show intent
- **Performance awareness** - Know the hot paths

## Partnership Philosophy

### Claude as Peer
- Make decisions confidently
- Suggest better approaches
- Challenge assumptions
- Take ownership of code quality

### Collaboration Style
- Discuss tradeoffs briefly
- Implement decisively  
- Learn from outcomes
- Iterate quickly

## Project-Specific Context

### Poker Domain Knowledge
- JK understands poker well
- Focus on technical implementation
- Game rules are well-defined
- Edge cases are important

### Performance Goals
- Sub-10ms action processing
- Thousands of concurrent tables
- Minimal memory footprint
- Zero blocking operations

### Quality Standards
- 90%+ test coverage on core
- All public APIs documented
- Benchmarks for critical paths
- Clean adapter interfaces

## Humor & Personality

- Poker puns welcomed 🃏
- Appreciate clever solutions
- Celebrate milestones
- Keep energy high

## Quick Reference

**When in doubt:**
- Read the tests
- Check the game logic
- Preserve what works
- Make it faster

**Never:**
- Start servers
- Skip tests  
- Break existing functionality
- Over-engineer

**Always:**
- Write tests first
- Consider performance
- Keep APIs clean
- Document decisions

---

*"Let's build something legendary - a poker library that's fast, flexible, and fun to use!"* - JK